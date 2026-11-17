import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import db from './db.js'
import {
  UPLOADED_BY_TYPES,
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
  derivePresentation,
  deleteMediaFile,
  buildMediaLink
} from './media.js'
import { USER_ROLES, canManageMedia, canViewMedia, isAdminUser } from './auth.js'
import { createModerationTask } from './moderationQueue.js'
import { isBlacklisted } from './ipBlacklist.js'

/**
 * 客户端 IP 获取：仅当 TRUST_PROXY=1 时才解析 X-Forwarded-For。
 * 无条件信任 XFF 的风险：源站端口暴露时可伪造 XFF 绕过限速/恶意拉黑他人。
 */
export function getClientIP(event) {
  const trustProxy = process.env.TRUST_PROXY === '1'
  return getRequestIP(event, { xForwardedFor: trustProxy }) || 'unknown'
}

export async function resolveSiteUrl(event) {
  const appSettingsDoc = await db.settings.findOne({ key: 'appSettings' })
  let siteUrl = appSettingsDoc?.value?.siteUrl || ''
  if (!siteUrl) {
    // 回退到请求头推断（首次部署未配置 siteUrl 时使用）。
    // 注意：x-forwarded-proto/host 仅在可信反代后有意义；生产环境强烈
    // 建议在后台配置固定 siteUrl，避免 Host 头投毒影响生成的外链。
    const protocolRaw = getHeader(event, 'x-forwarded-proto') || 'http'
    const protocol = ['http', 'https'].includes(protocolRaw) ? protocolRaw : 'http'
    const host = String(getHeader(event, 'host') || 'localhost').replace(/[^a-zA-Z0-9.:-]/g, '')
    siteUrl = `${protocol}://${host}`
    if (process.env.NODE_ENV === 'production') {
      console.warn('[SiteUrl] 未配置 siteUrl，正在使用请求头推断（建议在后台设置中配置固定站点 URL）')
    }
  }
  return siteUrl.replace(/\/+$/, '')
}

export function buildMediaResponse(record, siteUrl = '') {
  const media = toMediaRecord(record)
  const { url, coverUrl, poster } = derivePresentation(media)
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
    coverUrl,
    poster,
    isDeleted: media.isDeleted || false,
    isNsfw: media.isNsfw || false,
    moderationStatus: media.moderationStatus,
    moderationScore: media.moderationResult?.score || 0
  }
}

// 角色对应大小上限（兼容 uploadPolicy.sizeLimits 与历史扁平形状）
export function getMaxFileSizeForRole(config, role = USER_ROLES.ANONYMOUS) {
  if (config?.sizeLimits) {
    if (role === USER_ROLES.ADMIN) return config.sizeLimits.admin
    if (role === USER_ROLES.USER) return config.sizeLimits.user
    return config.sizeLimits.anonymous
  }
  if (role === USER_ROLES.ADMIN) return config.adminMaxFileSize
  if (role === USER_ROLES.USER) return config.userMaxFileSize
  return config.anonymousMaxFileSize
}

// 宽容的 MIME 归一化（部分客户端/远端服务会返回非规范写法）
function normalizeMime(mime = '') {
  const normalized = String(mime || '').toLowerCase().split(';')[0].trim()
  if (normalized === 'image/jpg') return 'image/jpeg'
  if (normalized === 'image/x-icon' || normalized === 'image/vnd.microsoft.icon') return 'image/x-icon'
  return normalized
}

/**
 * 内容嗅探：识别文件真实格式（magic bytes / 容器头）。
 * - 图片：sharp 解析 metadata.format（svg 识别为 'svg'；apng 归入 'png'；
 *   ico sharp 不支持，按 ICO magic 00 00 01 00 手动识别）
 * - 视频：容器头（mp4/mov = offset 4 处 'ftyp'；webm = EBML 头 0x1A45DFA3）
 * 返回 normalizeExtension 后的格式，无法识别返回 null。
 */
export async function sniffMediaFormat(buffer, mediaType) {
  if (!buffer || buffer.length === 0) return null

  if (mediaType === 'image') {
    try {
      // 注意 metadata() 返回 Promise，必须 await（否则嗅探结果恒为空导致全部误拒）
      const meta = await sharp(buffer, { animated: true }).metadata()
      if (meta?.format) return normalizeExtension(meta.format)
    } catch {
      // sharp 无法解析：ico/cur 特例（sharp 不支持）
      if (buffer.length > 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0) return 'ico'
      if (buffer.length > 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 2 && buffer[3] === 0) return 'ico'
      return null
    }
    return null
  }

  if (mediaType === 'video') {
    // ISO BMFF（mp4/mov）：前 4 字节 size + 'ftyp'
    if (buffer.length > 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'mp4'
    // Matroska/WebM：EBML magic 1A 45 DF A3
    if (buffer.length > 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm'
    return null
  }

  return null
}

export async function validateMediaByConfig({ file, role = USER_ROLES.ANONYMOUS, config, allowAnonymousUpload }) {
  const extension = normalizeExtension(getExtension(file.originalFilename || ''))
  const mediaTypeByExt = getMediaTypeByExtension(extension)
  const declaredMime = normalizeMime(file.mimetype || '')
  const expectedMime = getMimeTypeByExtension(extension)

  if (role === USER_ROLES.ANONYMOUS && !allowAnonymousUpload) {
    throw createError({ statusCode: 403, message: '当前未开放匿名公开上传' })
  }

  if (!config.allowedExtensions.includes(extension)) {
    throw createError({ statusCode: 400, message: `不支持的媒体格式：${extension || 'unknown'}` })
  }

  if (mediaTypeByExt === 'unknown') {
    throw createError({ statusCode: 400, message: '无法识别的媒体类型' })
  }

  // MIME 与扩展名精确匹配（此前仅比对"大类"，.png 声明 image/jpeg 也能通过）
  if (declaredMime && declaredMime !== expectedMime) {
    throw createError({ statusCode: 400, message: `文件扩展名与 MIME 类型不匹配（.${extension} 应为 ${expectedMime}）` })
  }

  const maxSize = getMaxFileSizeForRole(config, role)
  if (file.size > maxSize) {
    throw createError({ statusCode: 400, message: `文件大小超过限制（最大 ${Math.round(maxSize / 1024 / 1024)}MB）` })
  }

  // 内容嗅探：真实格式必须与声明扩展名一致，防止任意字节伪装成媒体入库。
  // apng 的 sharp 嗅探结果为 png，视为等价格式。
  const FORMAT_EQUIV = { apng: 'png' }
  const sniffed = await sniffMediaFormat(file.buffer, mediaTypeByExt)
  const sniffedEquiv = sniffed ? (FORMAT_EQUIV[sniffed] || sniffed) : null
  const extensionEquiv = FORMAT_EQUIV[extension] || extension
  if (!sniffed || sniffedEquiv !== extensionEquiv) {
    throw createError({
      statusCode: 400,
      message: `文件内容与声明的格式不符（检测到：${sniffed || '无法识别'}，声明：${extension}）`
    })
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

  if (mediaType === 'image') {
    const processed = await processImageWithConfig(buffer, extension, uploadConfig)
    buffer = processed.processedBuffer
    finalFormat = processed.finalFormat
    isWebp = processed.isWebp
    metadata = await getImageMetadata(buffer)
  }
  // 展示字段统一经 derivePresentation 推导（poster 一律不指向视频自身）
  const { coverUrl, poster } = derivePresentation({ uuid, format: finalFormat })

  const filename = `${uuid}.${finalFormat}`
  await saveUploadedFile(buffer, filename)

  if (!UPLOADED_BY_TYPES.includes(uploadedByType)) {
    throw createError({ statusCode: 400, message: `无效的上传来源类型：${uploadedByType}` })
  }

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
    ip: getClientIP(event),
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
  // 过滤/排序/分页下推到存储层（避免全表读入内存）。
  // 可见性与 canViewMedia 的语义保持一致：
  // - 匿名：仅公开且未删除/未违规
  // - 普通用户：公开 + 自己的
  // - 管理员：全部未删除未违规
  const base = { isDeleted: false, isNsfw: { $ne: true } }
  let query
  if (!user) {
    // 匿名：审核 pending 的媒体不出现在列表（否则卡片缩略图 403 满屏破图）
    query = { ...base, visibility: { $ne: 'private' }, moderationStatus: { $ne: 'pending' } }
  } else if (isAdminUser(user)) {
    query = base
  } else {
    // 普通用户：自己的 pending 可见；他人的 pending 不可见
    query = {
      ...base,
      $or: [
        { visibility: { $ne: 'private' }, moderationStatus: { $ne: 'pending' } },
        { ownerId: user._id }
      ]
    }
  }

  page = Math.max(1, parseInt(page) || 1)
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20))

  const total = await db.images.count(query)
  const items = await db.images.findPage(query, {
    sort: { uploadedAt: -1 },
    skip: (page - 1) * limit,
    limit
  })

  return {
    total,
    items: items.map(item => toMediaRecord(item))
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

/** 按查询条件物理删除媒体（文件 + 记录），供回收站清空与违规清空复用 */
export async function purgeMedia(query) {
  const items = await db.images.find(query)
  let deletedCount = 0
  const errors = []

  for (const item of items) {
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

export async function hardDeleteDeletedMedia() {
  return purgeMedia({ isDeleted: true })
}

export async function assertAnonymousUploadAllowed(event) {
  const ip = getClientIP(event)
  if (await isBlacklisted(ip)) {
    throw createError({ statusCode: 403, message: '您的 IP 已被禁止上传' })
  }
  const policy = await getUploadPolicy()
  if (!policy.allowAnonymousUpload) {
    throw createError({ statusCode: 403, message: '当前未开放匿名公开上传' })
  }
  return policy
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
  // 仅统计真正送检完成的（moderationStatus=completed），未启用审核时不再虚报
  const moderatedMedia = allMedia.filter(item => item.moderationStatus === 'completed')
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


