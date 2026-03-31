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

function isPrivateIp(ip = '') {
  if (!ip) return true
  if (net.isIPv4(ip)) {
    return ip.startsWith('10.')
      || ip.startsWith('127.')
      || ip.startsWith('192.168.')
      || ip.startsWith('169.254.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  }
  const normalized = ip.toLowerCase()
  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
}

async function assertSafeRemoteUrl(mediaUrl) {
  const hostname = mediaUrl.hostname.toLowerCase()
  if (PRIVATE_HOSTNAMES.has(hostname)) {
    throw createError({ statusCode: 400, message: '不允许导入本地或内网地址' })
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw createError({ statusCode: 400, message: '不允许导入本地或内网地址' })
    }
    return
  }

  const records = await dns.lookup(hostname, { all: true })
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

