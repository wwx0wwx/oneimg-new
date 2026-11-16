import https from 'https'
import http from 'http'
import { getRandomHeaders } from './fetchHeaders.js'
import { getMediaConfig } from './mediaConfig.js'
import { createMediaRecord, validateMediaByConfig } from './mediaService.js'
import { normalizeExtension, getMediaTypeByMime } from './media.js'
import { resolveOutboundAddr } from './netGuard.js'

const URL_IMPORT_TIMEOUT = 15000
const MAX_REMOTE_FILE_SIZE = 100 * 1024 * 1024
// 服务端批量导入上限（与前端一致，防止绕过前端限制）
export const MAX_URL_IMPORT_BATCH = 20

function getExtensionFromUrl(urlObj) {
  const match = urlObj.pathname.toLowerCase().match(/\.([a-z0-9]+)$/i)
  return match ? normalizeExtension(match[1]) : ''
}

function getExtensionFromContentType(contentType = '') {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/apng': 'apng',
    'image/tiff': 'tiff',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov'
  }
  return mimeToExt[String(contentType).split(';')[0].toLowerCase()] || ''
}

/**
 * 固定 IP 流式下载：
 * - DNS 校验得到的 IP 直接作为连接地址（lookup 钩子返回该 IP），
 *   消除"先校验后 fetch 再解析"的 DNS rebinding TOCTOU 窗口
 * - 不跟随重定向（3xx 视为错误），防止经重定向跳内网
 * - 流式计数，超过 maxBytes 立即中断，避免无界读入内存
 */
function downloadWithPinnedIp(url, ip, family, headers, maxBytes) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http
    const pinnedLookup = (_host, _opts, cb) => cb(null, [{ address: ip, family }])

    const req = client.request(url, {
      lookup: pinnedLookup,
      headers
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        res.resume()
        reject(new Error(`目标返回重定向（${res.statusCode}），已拒绝跟随`))
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }

      const contentType = res.headers['content-type'] || ''
      const contentLength = Number(res.headers['content-length'] || 0)
      if (contentLength > maxBytes) {
        res.resume()
        reject(new Error(`远程媒体大小超过限制（最大 ${Math.round(maxBytes / 1024 / 1024)}MB）`))
        return
      }

      const chunks = []
      let received = 0
      res.on('data', (chunk) => {
        received += chunk.length
        if (received > maxBytes) {
          req.destroy()
          reject(new Error(`远程媒体大小超过限制（最大 ${Math.round(maxBytes / 1024 / 1024)}MB）`))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }))
      res.on('error', reject)
    })

    req.setTimeout(URL_IMPORT_TIMEOUT, () => {
      req.destroy()
      reject(new Error('下载超时'))
    })
    req.on('error', reject)
    req.end()
  })
}

export async function importMediaFromUrl({ event, url, owner, ownerRole, uploadedByType, visibility, uploadConfig, returnBase64 = false, apiKeyId = null }) {
  let mediaUrl
  try {
    mediaUrl = new URL(url)
    if (!['http:', 'https:'].includes(mediaUrl.protocol)) {
      throw new Error('协议不支持')
    }
  } catch {
    throw createError({ statusCode: 400, message: '无效的 URL 格式' })
  }

  // 校验并固定连接 IP（私网/回环/映射地址/无法解析均拒绝）
  const { ip, family } = await resolveOutboundAddr(mediaUrl.hostname)

  let buffer
  let contentType
  try {
    const result = await downloadWithPinnedIp(
      mediaUrl, ip, family,
      getRandomHeaders(mediaUrl),
      MAX_REMOTE_FILE_SIZE
    )
    buffer = result.buffer
    contentType = result.contentType
  } catch (error) {
    throw createError({ statusCode: 400, message: `无法下载媒体: ${error.message}` })
  }

  const mediaType = getMediaTypeByMime(contentType)
  if (mediaType === 'unknown') {
    throw createError({ statusCode: 400, message: 'URL 指向的不是支持的图片或视频资源' })
  }

  const mediaConfig = await getMediaConfig()
  const ext = getExtensionFromUrl(mediaUrl) || getExtensionFromContentType(contentType) || (mediaType === 'video' ? 'mp4' : 'jpg')

  const file = {
    buffer,
    originalFilename: mediaUrl.pathname.split('/').pop() || `remote.${ext}`,
    mimetype: contentType.split(';')[0] || '',
    size: buffer.length
  }

  validateMediaByConfig({
    file,
    role: ownerRole,
    config: mediaConfig,
    allowAnonymousUpload: false
  })

  const { response: mediaResponse } = await createMediaRecord({
    event,
    file,
    owner,
    uploadedByType,
    visibility,
    uploadConfig,
    sourceUrl: url,
    apiKeyId
  })

  if (returnBase64 && mediaType === 'image') {
    mediaResponse.base64 = buffer.toString('base64')
  }

  return mediaResponse
}
