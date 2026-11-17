import db from './db.js'
import { ALL_MEDIA_FORMATS, normalizeExtension } from './media.js'
import { getDefaultContentSafetyConfig } from './moderation.js'

/**
 * 上传策略单一事实源（uploadPolicy）。
 *
 * 历史：策略分散在 mediaConfig / publicApiConfig / privateApiConfig 三个键中，
 * 语义交叠且存在死字段（privateApiConfig.maxFileSize 与 showOnHomepage 均无服务端消费方）。
 * v2.1.0 起统一为本模型：
 *
 * uploadPolicy = {
 *   allowAnonymousUpload, allowedExtensions,
 *   sizeLimits: { anonymous, user, admin },
 *   defaultUserVisibility: 'private' | 'public',
 *   processing: { enableCompression, quality, convertTo: 'none'|'webp'|'png' },
 *   limits: { anonymousPerMin, authenticatedPerMin, urlImportPerMin, loginPerMin },
 *   allowConcurrent: boolean,
 *   contentSafety: { enabled, provider, autoBlacklistIp, providers }
 * }
 *
 * 兼容与回滚策略：
 * - 读取：优先新键；新键不存在时由旧三键即时合并计算（未迁移部署同样正确）
 * - 迁移：启动时幂等落库新键，旧键原样保留
 * - 写入：旧端点（media/config、config/public、config/private）写对应字段域，
 *   并**双写旧键**——任意时刻回滚到 v1.3.3 均可读到一致配置
 * - 已删除死字段（不迁移）：privateApiConfig.maxFileSize、showOnHomepage（无消费方，见 v2.1.0 CHANGELOG）
 */

export const URL_IMPORT_PER_MIN = 10
export const LOGIN_PER_MIN = 5

export const DEFAULT_UPLOAD_POLICY = {
  allowAnonymousUpload: false,
  allowedExtensions: [...ALL_MEDIA_FORMATS],
  sizeLimits: {
    anonymous: 10 * 1024 * 1024,
    user: 50 * 1024 * 1024,
    admin: 100 * 1024 * 1024
  },
  defaultUserVisibility: 'private',
  processing: {
    enableCompression: false,
    quality: 80,
    convertTo: 'none'
  },
  limits: {
    anonymousPerMin: 10,
    authenticatedPerMin: 60,
    urlImportPerMin: URL_IMPORT_PER_MIN,
    loginPerMin: LOGIN_PER_MIN
  },
  allowConcurrent: false,
  contentSafety: getDefaultContentSafetyConfig()
}

// processing 双向映射：扁平旧字段（两份配置通用形状） <-> 嵌套新字段
function processingToFlat(processing = {}) {
  return {
    enableCompression: processing.enableCompression === true,
    compressionQuality: Number(processing.quality) > 0 ? Number(processing.quality) : 80,
    convertToWebp: processing.convertTo === 'webp',
    convertToPng: processing.convertTo === 'png'
  }
}

function flatToProcessing(flat = {}) {
  return {
    enableCompression: flat.enableCompression === true,
    quality: Number(flat.compressionQuality) > 0 ? Number(flat.compressionQuality) : 80,
    convertTo: flat.convertToPng === true ? 'png' : (flat.convertToWebp === true ? 'webp' : 'none')
  }
}

function normalizeAllowedExtensions(value) {
  if (!Array.isArray(value) || value.length === 0) return [...ALL_MEDIA_FORMATS]
  const normalized = [...new Set(value.map(item => normalizeExtension(item)).filter(Boolean))]
  const valid = normalized.filter(item => ALL_MEDIA_FORMATS.includes(item))
  return valid.length > 0 ? valid : [...ALL_MEDIA_FORMATS]
}

function normalizePolicy(value = {}) {
  const d = DEFAULT_UPLOAD_POLICY
  return {
    allowAnonymousUpload: value.allowAnonymousUpload === true,
    allowedExtensions: normalizeAllowedExtensions(value.allowedExtensions),
    sizeLimits: {
      anonymous: Number(value.sizeLimits?.anonymous) > 0 ? Math.round(Number(value.sizeLimits.anonymous)) : d.sizeLimits.anonymous,
      user: Number(value.sizeLimits?.user) > 0 ? Math.round(Number(value.sizeLimits.user)) : d.sizeLimits.user,
      admin: Number(value.sizeLimits?.admin) > 0 ? Math.round(Number(value.sizeLimits.admin)) : d.sizeLimits.admin
    },
    defaultUserVisibility: value.defaultUserVisibility === 'public' ? 'public' : 'private',
    processing: {
      enableCompression: value.processing?.enableCompression === true,
      quality: Number(value.processing?.quality) > 0 ? Number(value.processing.quality) : d.processing.quality,
      convertTo: ['none', 'webp', 'png'].includes(value.processing?.convertTo) ? value.processing.convertTo : 'none'
    },
    limits: {
      anonymousPerMin: Number(value.limits?.anonymousPerMin) > 0 ? Math.round(Number(value.limits.anonymousPerMin)) : d.limits.anonymousPerMin,
      authenticatedPerMin: Number(value.limits?.authenticatedPerMin) > 0 ? Math.round(Number(value.limits.authenticatedPerMin)) : d.limits.authenticatedPerMin,
      urlImportPerMin: Number(value.limits?.urlImportPerMin) > 0 ? Math.round(Number(value.limits.urlImportPerMin)) : d.limits.urlImportPerMin,
      loginPerMin: Number(value.limits?.loginPerMin) > 0 ? Math.round(Number(value.limits.loginPerMin)) : d.limits.loginPerMin
    },
    allowConcurrent: value.allowConcurrent === true,
    contentSafety: value.contentSafety || getDefaultContentSafetyConfig()
  }
}

/** 由三个旧配置键合并出 uploadPolicy（字段域优先级见函数注释） */
function mergeFromLegacy({ mediaConfig = {}, publicApiConfig = {}, privateApiConfig = {} }) {
  return normalizePolicy({
    allowAnonymousUpload: mediaConfig.allowAnonymousUpload === true,
    allowedExtensions: mediaConfig.allowedExtensions,
    sizeLimits: {
      anonymous: mediaConfig.anonymousMaxFileSize,
      user: mediaConfig.userMaxFileSize,
      admin: mediaConfig.adminMaxFileSize
    },
    defaultUserVisibility: mediaConfig.defaultUserVisibility,
    // 压缩/转换历史上 public/private 各一份：合一取登录侧（主场景），
    // 两份不一致的部署以 CHANGELOG 说明为准
    processing: flatToProcessing(privateApiConfig.enableCompression !== undefined ? privateApiConfig : publicApiConfig),
    limits: {
      anonymousPerMin: publicApiConfig.rateLimit,
      authenticatedPerMin: privateApiConfig.rateLimit
    },
    allowConcurrent: publicApiConfig.allowConcurrent === true,
    contentSafety: publicApiConfig.contentSafety || getDefaultContentSafetyConfig()
  })
}

/**
 * 读取上传策略：优先新键 uploadPolicy；否则由旧三键即时合并（不落库）。
 * 调用方（上传/导入/限速/审核队列/配置端点）统一使用本函数。
 */
export async function getUploadPolicy() {
  const [newDoc, mediaDoc, publicDoc, privateDoc] = await Promise.all([
    db.settings.findOne({ key: 'uploadPolicy' }),
    db.settings.findOne({ key: 'mediaConfig' }),
    db.settings.findOne({ key: 'publicApiConfig' }),
    db.settings.findOne({ key: 'privateApiConfig' })
  ])

  if (newDoc?.value) {
    return normalizePolicy(newDoc.value)
  }
  return mergeFromLegacy({
    mediaConfig: mediaDoc?.value || {},
    publicApiConfig: publicDoc?.value || {},
    privateApiConfig: privateDoc?.value || {}
  })
}

/** 保存完整 uploadPolicy（规范化后落库） */
export async function saveUploadPolicy(policy) {
  const merged = normalizePolicy(policy)
  await db.settings.update(
    { key: 'uploadPolicy' },
    { $set: { value: merged, updatedAt: new Date().toISOString() } },
    { upsert: true }
  )
  return merged
}

/**
 * 启动迁移（幂等）：旧键存在且新键不存在时合并落库；旧键原样保留（回滚窗口）。
 * 已存在新键则跳过——回滚到旧版本修改旧键后再次升级时，以旧键重新合并会覆盖新键变更，
 * 因此检测到"旧键比新键新"（updatedAt 更晚）时重新合并。
 */
export async function migrateToUploadPolicy() {
  const [newDoc, mediaDoc, publicDoc, privateDoc] = await Promise.all([
    db.settings.findOne({ key: 'uploadPolicy' }),
    db.settings.findOne({ key: 'mediaConfig' }),
    db.settings.findOne({ key: 'publicApiConfig' }),
    db.settings.findOne({ key: 'privateApiConfig' })
  ])

  const legacyNewest = Math.max(
    new Date(mediaDoc?.updatedAt || 0).getTime() || 0,
    new Date(publicDoc?.updatedAt || 0).getTime() || 0,
    new Date(privateDoc?.updatedAt || 0).getTime() || 0
  )
  const currentAt = new Date(newDoc?.updatedAt || 0).getTime() || 0

  // 端点双写保证新旧键同步更新（updatedAt 相近）；此处仅处理
  // "新键不存在"或"旧键明显更新（例如回滚期改过旧键）"两种情况
  if (newDoc?.value && legacyNewest <= currentAt + 5000) {
    return { migrated: false }
  }

  const merged = mergeFromLegacy({
    mediaConfig: mediaDoc?.value || {},
    publicApiConfig: publicDoc?.value || {},
    privateApiConfig: privateDoc?.value || {}
  })
  // 若新键已存在且旧键没有更新过（纯重启），不覆盖新键内容
  if (newDoc?.value && legacyNewest === 0) {
    return { migrated: false }
  }
  await saveUploadPolicy(merged)
  console.log('[UploadPolicy] 已由历史配置合并生成统一上传策略（旧配置键保留用于回滚）')
  return { migrated: true }
}

/**
 * 双写旧键：任一域变更时同步对应旧键，保证可随时回滚到 v1.3.3 且配置一致。
 * 由各配置端点在写入后调用。
 */
export async function syncLegacyKeys(policy) {
  const now = new Date().toISOString()
  const mediaValue = {
    allowAnonymousUpload: policy.allowAnonymousUpload,
    allowedExtensions: policy.allowedExtensions,
    anonymousMaxFileSize: policy.sizeLimits.anonymous,
    userMaxFileSize: policy.sizeLimits.user,
    adminMaxFileSize: policy.sizeLimits.admin,
    defaultUserVisibility: policy.defaultUserVisibility
  }
  const flatProcessing = processingToFlat(policy.processing)
  const publicValue = {
    ...flatProcessing,
    rateLimit: policy.limits.anonymousPerMin,
    allowConcurrent: policy.allowConcurrent,
    contentSafety: policy.contentSafety
  }
  const privateValue = {
    ...flatProcessing,
    rateLimit: policy.limits.authenticatedPerMin
  }

  await Promise.all([
    db.settings.update({ key: 'mediaConfig' }, { $set: { value: mediaValue, updatedAt: now } }, { upsert: true }),
    db.settings.update({ key: 'publicApiConfig' }, { $set: { value: publicValue, updatedAt: now } }, { upsert: true }),
    db.settings.update({ key: 'privateApiConfig' }, { $set: { value: privateValue, updatedAt: now } }, { upsert: true })
  ])
}

export { processingToFlat, flatToProcessing, mergeFromLegacy }
