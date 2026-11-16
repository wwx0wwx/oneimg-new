import sharp from 'sharp'
import { join, extname } from 'path'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { writeFile } from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'

// 上传目录优先级与 db.js 的数据目录保持一致：
// ONEIMG_DATA_DIR/uploads > 生产默认 /app/uploads > 开发默认 <cwd>/uploads
const uploadsDir = process.env.ONEIMG_DATA_DIR
  ? join(process.env.ONEIMG_DATA_DIR, 'uploads')
  : (process.env.NODE_ENV === 'production'
    ? '/app/uploads'
    : join(process.cwd(), 'uploads'))

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}

export const IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'tiff', 'tif']
export const VIDEO_FORMATS = ['mp4', 'webm', 'mov']
export const ALL_MEDIA_FORMATS = [...IMAGE_FORMATS, ...VIDEO_FORMATS]

export const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  apng: 'image/apng',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime'
}

export function getExtension(filename = '') {
  return extname(filename).toLowerCase().replace('.', '')
}

export function normalizeExtension(ext = '') {
  const normalized = String(ext).toLowerCase().trim().replace(/^\./, '')
  if (normalized === 'jpeg') return 'jpg'
  if (normalized === 'tif') return 'tiff'
  return normalized
}

export function getMediaTypeByExtension(ext = '') {
  const normalized = normalizeExtension(ext)
  if (IMAGE_FORMATS.includes(normalized)) return 'image'
  if (VIDEO_FORMATS.includes(normalized)) return 'video'
  return 'unknown'
}

export function getMediaTypeByMime(mime = '') {
  const normalized = String(mime).toLowerCase().split(';')[0].trim()
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('video/')) return 'video'
  return 'unknown'
}

export function getMimeTypeByExtension(ext = '') {
  return MIME_BY_EXT[normalizeExtension(ext)] || 'application/octet-stream'
}

export function sanitizeOriginalName(filename = '', fallbackExt = '') {
  const ext = normalizeExtension(getExtension(filename) || fallbackExt || '')
  const basename = String(filename || 'file')
    .replace(/[\\/]+/g, '_')
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120)
  const safeBase = basename || 'file'
  if (safeBase.includes('.') || !ext) {
    return safeBase
  }
  return `${safeBase}.${ext}`
}

export function generateStoredFilename(extension) {
  return `${uuidv4()}.${normalizeExtension(extension)}`
}

export async function saveUploadedFile(buffer, filename) {
  const filepath = join(uploadsDir, filename)
  await writeFile(filepath, buffer)
  return filepath
}

export async function getImageMetadata(buffer) {
  try {
    const metadata = await sharp(buffer, { animated: true }).metadata()
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: normalizeExtension(metadata.format || ''),
      size: buffer.length
    }
  } catch (error) {
    return { width: 0, height: 0, format: 'unknown', size: buffer.length }
  }
}

export async function processImage(buffer, options = {}) {
  const { format = 'webp', quality = 80 } = options
  const targetFormat = normalizeExtension(format)
  return await sharp(buffer, { animated: true })
    .toFormat(targetFormat, { quality })
    .toBuffer()
}

export async function processImageWithConfig(buffer, fileExt, config = {}, minSizeKb = 0) {
  let processedBuffer = buffer
  let finalFormat = normalizeExtension(fileExt)
  let isWebp = false

  const fileSizeInKb = buffer.length / 1024
  const shouldProcess = config.enableCompression
    && finalFormat !== 'gif'
    && (minSizeKb === 0 || fileSizeInKb > minSizeKb)

  if (shouldProcess) {
    const quality = config.compressionQuality || config.webpQuality || 80
    if (config.convertToWebp || config.compressToWebp) {
      processedBuffer = await processImage(buffer, { format: 'webp', quality })
      finalFormat = 'webp'
      isWebp = true
    } else if (config.convertToPng) {
      processedBuffer = await processImage(buffer, { format: 'png', quality })
      finalFormat = 'png'
    } else {
      processedBuffer = await processImage(buffer, { format: finalFormat, quality })
    }
  }

  return { processedBuffer, finalFormat, isWebp }
}

export async function parseFormData(event) {
  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    return { file: null }
  }

  const fileField = formData.find(field => field.name === 'file' || field.name === 'image')

  if (!fileField || !fileField.data) {
    return { file: null }
  }

  return {
    file: {
      buffer: fileField.data,
      originalFilename: fileField.filename || 'unknown',
      mimetype: fileField.type,
      size: fileField.data.length
    }
  }
}

export function getMediaPath(filename) {
  return join(uploadsDir, filename)
}



export function getImageFilePath(filename) {
  return getMediaPath(filename)
}


export function getUploadsDir() {
  return uploadsDir
}

export function getUploadsDirPath() {
  return uploadsDir
}

export function deleteMediaFile(filename) {
  const filepath = join(uploadsDir, filename)
  if (existsSync(filepath)) {
    unlinkSync(filepath)
    return true
  }
  return false
}



export function isValidFormat(format, allowedFormats = []) {
  return allowedFormats.map(item => normalizeExtension(item)).includes(normalizeExtension(format))
}

export function inferMediaType(record = {}) {
  if (record.mediaType) return record.mediaType
  return getMediaTypeByExtension(record.format || getExtension(record.filename || ''))
}

export function normalizeVisibility(record = {}) {
  if (record.visibility) return record.visibility
  return record.uploadedByType === 'public' ? 'public' : 'private'
}

export function normalizeOwner(record = {}) {
  return {
    ownerId: record.ownerId || null,
    ownerName: record.ownerName || record.uploadedBy || '匿名用户',
    ownerRole: record.ownerRole || (record.ownerId ? 'user' : 'anonymous')
  }
}

export function toMediaRecord(record = {}) {
  const ext = normalizeExtension(record.format || getExtension(record.filename || ''))
  const mediaType = inferMediaType(record)
  const visibility = normalizeVisibility(record)
  const owner = normalizeOwner(record)
  const coverUrl = record.coverUrl || `/i/${record.uuid}.${ext}`

  return {
    ...record,
    mediaType,
    visibility,
    coverUrl,
    mimeType: record.mimeType || getMimeTypeByExtension(ext),
    duration: record.duration || 0,
    poster: record.poster || (mediaType === 'video' ? coverUrl : ''),
    ...owner
  }
}

export function buildMediaLink(media, origin = '') {
  const base = origin ? origin.replace(/\/+$/, '') : ''
  const url = media.url || `/i/${media.uuid}.${normalizeExtension(media.format)}`
  return base ? `${base}${url}` : url
}
