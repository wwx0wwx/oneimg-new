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
 * v2.2 清理期说明：
 * - 旧三键（mediaConfig/publicApiConfig/privateApiConfig）的读取兜底与写入双写已移除；
 *   升级路径：v2.2 首次启动时若旧键存在仍会合并迁移一次（此后新键存在即跳过）
 * - 旧键出清：运行 scripts/purge-legacy-keys.mjs（需停机）
 * - 自 v2.2 起回滚语义变化：回滚到 v2.1.x 前请先备份（旧键出清后旧版本将读到默认配置）
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

// contentSafety 清洗：providers 白名单 + 客户端回传 apiKey 一律剥离
// （与 config/public.put 同标准——PUT /api/upload-policy 的整体透传
//  不能成为绕过密钥剥离的后门）
function sanitizeContentSafety(cs = {}) {
  const KNOWN_PROVIDERS = ['nsfwdet', 'elysiatools', 'nsfw_detector']
  const providers = {}
  for (const key of KNOWN_PROVIDERS) {
    if (cs.providers && cs.providers[key] && typeof cs.providers[key] === 'object') {
      providers[key] = { ...cs.providers[key], apiKey: '' }
    }
  }
  return {
    enabled: cs.enabled === true,
    provider: typeof cs.provider === 'string' ? cs.provider : 'elysiatools',
    autoBlacklistIp: cs.autoBlacklistIp === true,
    providers
  }
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
    contentSafety: value.contentSafety ? sanitizeContentSafety(value.contentSafety) : getDefaultContentSafetyConfig()
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
  const doc = await db.settings.findOne({ key: 'uploadPolicy' })
  if (doc?.value) {
    return normalizePolicy(doc.value)
  }
  // 理论上启动迁移保证新键存在；兜底返回默认值并交由下次启动迁移落库
  return normalizePolicy(DEFAULT_UPLOAD_POLICY)
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
  // v2.2：新键存在即跳过（旧键不再被读取或双写）；
  // 新键不存在时由旧键（若在）或默认值生成——覆盖全新安装与 v1.x 升级两种路径
  const newDoc = await db.settings.findOne({ key: 'uploadPolicy' })
  if (newDoc?.value) {
    return { migrated: false }
  }

  const [mediaDoc, publicDoc, privateDoc] = await Promise.all([
    db.settings.findOne({ key: 'mediaConfig' }),
    db.settings.findOne({ key: 'publicApiConfig' }),
    db.settings.findOne({ key: 'privateApiConfig' })
  ])

  const merged = mergeFromLegacy({
    mediaConfig: mediaDoc?.value || {},
    publicApiConfig: publicDoc?.value || {},
    privateApiConfig: privateDoc?.value || {}
  })
  await saveUploadPolicy(merged)
  console.log('[UploadPolicy] 已生成统一上传策略（v1.x 旧配置已合并，可用 scripts/purge-legacy-keys.mjs 出清）')
  return { migrated: true }
}

export { processingToFlat, flatToProcessing, mergeFromLegacy }
