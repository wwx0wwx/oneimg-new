import { v4 as uuidv4 } from 'uuid'
import db from './db.js'
import {
  getExtension,
  normalizeExtension,
  getMediaTypeByExtension,
  getMediaTypeByMime,
  getMimeTypeByExtension,
  sanitizeOriginalName,
  saveUploadedFile,
  getImageMetadata,
  processImageWithConfig,
  toMediaRecord,
  deleteMediaFile,
  buildMediaLink
} from './media.js'
import { getMediaConfig, getMaxFileSizeForRole } from './mediaConfig.js'
import { USER_ROLES, canManageMedia, canViewMedia, isAdminUser } from './auth.js'
import { createModerationTask } from './moderationQueue.js'
import { isBlacklisted } from './ipBlacklist.js'

export async function resolveSiteUrl(event) {
  const appSettingsDoc = await db.settings.findOne({ key: 'appSettings' })
  let siteUrl = appSettingsDoc?.value?.siteUrl || ''
  if (!siteUrl) {
    const protocol = getHeader(event, 'x-forwarded-proto') || 'http'
    const host = getHeader(event, 'host') || 'localhost'
    siteUrl = `${protocol}://${host}`
  }
  return siteUrl.replace(/\/+$/, '')
}

export function buildMediaResponse(record, siteUrl = '') {
  const media = toMediaRecord(record)
  const url = `/i/${media.uuid}.${normalizeExtension(media.format)}`
  return {
    id: media._id,
    uuid: media.uuid,
    filename: media.filename,
    originalName: media.originalName,
    format: normalizeExtension(media.format),
    mediaType: media.mediaType,
    mimeType: media.mimeType,
    size: media.size,
    width: media.width || 0,
    height: media.height || 0,
    duration: media.duration || 0,
    visibility: media.visibility,
    ownerId: media.ownerId,
    ownerName: media.ownerName,
    ownerRole: media.ownerRole,
    uploadedBy: media.ownerName,
    uploadedByType: media.uploadedByType,
    apiKeyId: media.apiKeyId || null,
    uploadedAt: media.uploadedAt,
    url,
    fullUrl: buildMediaLink({ ...media, url }, siteUrl),
    coverUrl: media.coverUrl || url,
    poster: media.poster || (media.mediaType === 'video' ? media.coverUrl || url : ''),
    isDeleted: media.isDeleted || false,
    isNsfw: media.isNsfw || false,
    moderationStatus: media.moderationStatus,
    moderationScore: media.moderationResult?.score || 0
  }
}

export function validateMediaByConfig({ file, role = USER_ROLES.ANONYMOUS, config, allowAnonymousUpload }) {
  const extension = normalizeExtension(getExtension(file.originalFilename || ''))
  const mediaTypeByExt = getMediaTypeByExtension(extension)
  const mediaTypeByMime = getMediaTypeByMime(file.mimetype || '')

  if (role === USER_ROLES.ANONYMOUS && !allowAnonymousUpload) {
    throw createError({ statusCode: 403, message: '当前未开放匿名公开上传' })
  }

  if (!config.allowedExtensions.includes(extension)) {
    throw createError({ statusCode: 400, message: `不支持的媒体格式：${extension || 'unknown'}` })
  }

  if (mediaTypeByExt === 'unknown' || mediaTypeByMime === 'unknown') {
    throw createError({ statusCode: 400, message: '无法识别的媒体类型' })
  }

  if (mediaTypeByExt !== mediaTypeByMime) {
    throw createError({ statusCode: 400, message: '文件扩展名与 MIME 类型不匹配' })
  }

  const maxSize = getMaxFileSizeForRole(config, role)
  if (file.size > maxSize) {
    throw createError({ statusCode: 400, message: `文件大小超过限制（最大 ${Math.round(maxSize / 1024 / 1024)}MB）` })
  }

  return {
    extension,
    mediaType: mediaTypeByExt,
    maxSize
  }
}

export async function createMediaRecord({
  event,
  file,
  owner,
  uploadedByType,
  visibility,
  uploadConfig,
  enableModeration = false,
  sourceUrl = '',
  apiKeyId = null
}) {
  const siteUrl = await resolveSiteUrl(event)
  const extension = normalizeExtension(getExtension(file.originalFilename || ''))
  const mediaType = getMediaTypeByExtension(extension)
  const originalName = sanitizeOriginalName(file.originalFilename || `${mediaType}.${extension}`, extension)
  const uuid = uuidv4()

  let buffer = file.buffer
  let finalFormat = extension
  let isWebp = false
  let metadata = { width: 0, height: 0 }
  let coverUrl = `/i/${uuid}.${extension}`
  let poster = ''

  if (mediaType === 'image') {
    const processed = await processImageWithConfig(buffer, extension, uploadConfig)
    buffer = processed.processedBuffer
    finalFormat = processed.finalFormat
    isWebp = processed.isWebp
    metadata = await getImageMetadata(buffer)
    coverUrl = `/i/${uuid}.${finalFormat}`
  } else {
    coverUrl = `/i/${uuid}.${finalFormat}`
    poster = coverUrl
  }

  const filename = `${uuid}.${finalFormat}`
  await saveUploadedFile(buffer, filename)

  const normalizedOwner = {
    id: owner?.id || null,
    name: owner?.name || '匿名用户',
    role: owner?.role || USER_ROLES.ANONYMOUS
  }

  const record = {
    _id: uuidv4(),
    uuid,
    originalName,
    filename,
    format: finalFormat,
    mimeType: getMimeTypeByExtension(finalFormat),
    mediaType,
    size: buffer.length,
    width: metadata.width || 0,
    height: metadata.height || 0,
    duration: 0,
    poster,
    coverUrl,
    isWebp,
    isDeleted: false,
    isNsfw: false,
    visibility,
    ownerId: normalizedOwner.id,
    ownerName: normalizedOwner.name,
    ownerRole: normalizedOwner.role,
    uploadedBy: normalizedOwner.name,
    uploadedByType,
    apiKeyId,
    sourceUrl,
    ip: getRequestIP(event, { xForwardedFor: true }) || 'unknown',
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    moderationStatus: enableModeration && mediaType === 'image' ? 'pending' : 'skipped',
    moderationResult: enableModeration && mediaType === 'image' ? null : { skipped: true },
    moderationChecked: !(enableModeration && mediaType === 'image')
  }

  await db.images.insert(record)

  if (enableModeration && mediaType === 'image') {
    await createModerationTask(record._id, uuid, filename)
  }

  return {
    record,
    response: buildMediaResponse(record, siteUrl)
  }
}

export async function listVisibleMedia({ user = null, page = 1, limit = 20 }) {
  const all = (await db.images.find({ isDeleted: false, isNsfw: { $ne: true } }))
    .map(item => toMediaRecord(item))
    .filter(item => canViewMedia(user, item))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))

  const total = all.length
  const start = (page - 1) * limit
  return {
    total,
    items: all.slice(start, start + limit)
  }
}

export async function getMediaByUuid(uuid) {
  if (!uuid) return null
  const item = await db.images.findOne({ uuid })
  return item ? toMediaRecord(item) : null
}

export async function getMediaById(id) {
  if (!id) return null
  const item = await db.images.findOne({ _id: id })
  return item ? toMediaRecord(item) : null
}

export async function assertMediaAccess({ user = null, uuid, allowNsfw = false, allowDeleted = false }) {
  const media = await getMediaByUuid(uuid)
  if (!media) {
    throw createError({ statusCode: 404, message: '媒体不存在' })
  }

  if (!allowDeleted && media.isDeleted) {
    throw createError({ statusCode: 404, message: '媒体不存在' })
  }

  if (!allowNsfw && media.isNsfw) {
    throw createError({ statusCode: 403, message: '该媒体因违规已被禁止访问' })
  }

  if (!canViewMedia(user, media)) {
    throw createError({ statusCode: 403, message: '无权访问该媒体' })
  }

  return media
}

export async function softDeleteMedia({ id, user }) {
  const media = await getMediaById(id)
  if (!media) {
    throw createError({ statusCode: 404, message: '媒体不存在' })
  }

  if (!canManageMedia(user, media)) {
    throw createError({ statusCode: 403, message: '无权删除该媒体' })
  }

  await db.images.update(
    { _id: id },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user.username,
        updatedAt: new Date().toISOString()
      }
    }
  )
}

export async function batchSoftDeleteMedia({ ids, user }) {
  let deletedCount = 0
  const errors = []

  for (const id of ids) {
    try {
      await softDeleteMedia({ id, user })
      deletedCount++
    } catch (error) {
      errors.push({ id, message: error.statusCode ? error.message : '删除失败' })
    }
  }

  return { deletedCount, errors }
}

export async function hardDeleteDeletedMedia() {
  const deletedItems = await db.images.find({ isDeleted: true })
  let deletedCount = 0
  const errors = []

  for (const item of deletedItems) {
    try {
      deleteMediaFile(item.filename)
      await db.images.remove({ _id: item._id })
      deletedCount++
    } catch {
      errors.push(item.uuid)
    }
  }

  return { deletedCount, errors }
}

export async function assertAnonymousUploadAllowed(event) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  if (await isBlacklisted(ip)) {
    throw createError({ statusCode: 403, message: '您的 IP 已被禁止上传' })
  }
  const config = await getMediaConfig()
  if (!config.allowAnonymousUpload) {
    throw createError({ statusCode: 403, message: '当前未开放匿名公开上传' })
  }
  return config
}

export async function getMediaStats() {
  const allMedia = await db.images.find({})
  const activeMedia = allMedia.filter(item => !item.isDeleted)
  const publicMedia = activeMedia.filter(item => item.visibility === 'public')
  const privateMedia = activeMedia.filter(item => item.visibility === 'private')
  const imageCount = activeMedia.filter(item => item.mediaType !== 'video').length
  const videoCount = activeMedia.filter(item => item.mediaType === 'video').length
  const deletedMedia = allMedia.filter(item => item.isDeleted)
  const totalSize = allMedia.reduce((sum, item) => sum + (item.size || 0), 0)
  const deletedSize = deletedMedia.reduce((sum, item) => sum + (item.size || 0), 0)
  const moderatedMedia = allMedia.filter(item => item.mediaType === 'image' && item.moderationChecked)
  const nsfwMedia = allMedia.filter(item => item.isNsfw)
  const nsfwRate = moderatedMedia.length > 0 ? Number(((nsfwMedia.length / moderatedMedia.length) * 100).toFixed(2)) : 0

  return {
    totalImages: activeMedia.length,
    publicImages: publicMedia.length,
    privateImages: privateMedia.length,
    imageCount,
    videoCount,
    totalSize,
    activeSize: totalSize - deletedSize,
    deletedSize,
    deletedImagesCount: deletedMedia.length,
    moderatedImagesCount: moderatedMedia.length,
    nsfwImagesCount: nsfwMedia.length,
    nsfwRate
  }
}


