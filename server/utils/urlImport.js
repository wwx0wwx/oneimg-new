import dns from 'dns/promises'
import net from 'net'
import { getRandomHeaders } from './fetchHeaders.js'
import { getMediaConfig } from './mediaConfig.js'
import { createMediaRecord, validateMediaByConfig } from './mediaService.js'
import { normalizeExtension, getMediaTypeByMime } from './media.js'

const URL_IMPORT_TIMEOUT = 15000
const MAX_REMOTE_FILE_SIZE = 100 * 1024 * 1024
const PRIVATE_HOSTNAMES = new Set(['localhost', '0.0.0.0'])

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

// 归一化 IP 字符串用于私网判断：
// - WHATWG URL 的 hostname 对 IPv6 字面量带方括号（如 "[::1]"），需先剥离
// - IPv4-mapped IPv6（::ffff:127.0.0.1）还原为 IPv4 再判断，否则会绕过私网检查
function normalizeIpForCheck(ip = '') {
  return String(ip || '').trim().replace(/^\[|\]$/g, '')
}

function isPrivateIp(ip = '') {
  const normalized = normalizeIpForCheck(ip).toLowerCase()
  if (!normalized) return true

  // IPv4-mapped IPv6 → 按 IPv4 判断。有两种写法都要覆盖：
  // - 点分形式：::ffff:127.0.0.1
  // - 十六进制形式：::ffff:7f00:1（Node 的 WHATWG URL 会把点分形式规范化成这种）
  const mappedDotted = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mappedDotted) return isPrivateIp(mappedDotted[1])
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16)
    const lo = parseInt(mappedHex[2], 16)
    const v4 = [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join('.')
    return isPrivateIp(v4)
  }

  if (net.isIPv4(normalized)) {
    const octets = normalized.split('.').map(Number)
    const [a, b] = octets
    return a === 0                                   // 0.0.0.0/8 "this network"
      || a === 10                                    // 10.0.0.0/8
      || a === 127                                   // 127.0.0.0/8 loopback
      || (a === 100 && b >= 64 && b <= 127)          // 100.64.0.0/10 CGNAT
      || (a === 169 && b === 254)                    // 169.254.0.0/16 link-local（含云元数据）
      || (a === 172 && b >= 16 && b <= 31)           // 172.16.0.0/12
      || (a === 192 && b === 168)                    // 192.168.0.0/16
  }

  // IPv6
  return normalized === '::' || normalized === '::1'          // 未指定/回环
    || normalized.startsWith('::ffff:0:')                      // NAT64 ::ffff:0:0/96 映射段
    || normalized.startsWith('fc') || normalized.startsWith('fd')  // ULA fc00::/7
    || normalized.startsWith('fe80:')                          // link-local
    || normalized.startsWith('fec0:')                          // site-local（已废弃但仍应拒绝）
}

async function assertSafeRemoteUrl(mediaUrl) {
  const hostname = normalizeIpForCheck(mediaUrl.hostname).toLowerCase()
  if (PRIVATE_HOSTNAMES.has(hostname)) {
    throw createError({ statusCode: 400, message: '不允许导入本地或内网地址' })
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw createError({ statusCode: 400, message: '不允许导入本地或内网地址' })
    }
    return
  }

  let records
  try {
    records = await dns.lookup(hostname, { all: true })
  } catch {
    throw createError({ statusCode: 400, message: '无法解析的主机名' })
  }
  if (!records.length || records.some(record => isPrivateIp(record.address))) {
    throw createError({ statusCode: 400, message: '不允许导入本地或内网地址' })
  }
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

  await assertSafeRemoteUrl(mediaUrl)

  let response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), URL_IMPORT_TIMEOUT)
    response = await fetch(url, {
      signal: controller.signal,
      headers: getRandomHeaders(mediaUrl),
      redirect: 'error'
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createError({ statusCode: 408, message: '下载超时，请稍后重试' })
    }
    throw createError({ statusCode: 400, message: `无法下载媒体: ${error.message}` })
  }

  const contentType = response.headers.get('content-type') || ''
  const mediaType = getMediaTypeByMime(contentType)
  if (mediaType === 'unknown') {
    throw createError({ statusCode: 400, message: 'URL 指向的不是支持的图片或视频资源' })
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_REMOTE_FILE_SIZE) {
    throw createError({ statusCode: 400, message: `远程媒体大小超过限制（最大 ${Math.round(MAX_REMOTE_FILE_SIZE / 1024 / 1024)}MB）` })
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.length > MAX_REMOTE_FILE_SIZE) {
    throw createError({ statusCode: 400, message: `远程媒体大小超过限制（最大 ${Math.round(MAX_REMOTE_FILE_SIZE / 1024 / 1024)}MB）` })
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

