import db from '../utils/db.js'

const requestCounts = new Map()
const uploadingClients = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.startTime > 60000) {
      requestCounts.delete(key)
    }
  }
}, 60000)

export async function checkRateLimit(type, identifier, opts = {}) {
  let rateLimit = opts.limit

  if (!Number.isFinite(rateLimit) || rateLimit <= 0) {
    const configKey = type === 'public' ? 'publicApiConfig' : 'privateApiConfig'
    const config = await db.settings.findOne({ key: configKey })
    rateLimit = config?.value?.rateLimit
  }

  if (!rateLimit || rateLimit <= 0) {
    return { allowed: true }
  }

  const key = `${type}:${identifier}`
  const now = Date.now()
  let record = requestCounts.get(key)

  if (!record || now - record.startTime > 60000) {
    record = { count: 1, startTime: now }
    requestCounts.set(key, record)
    return { allowed: true, remaining: rateLimit - 1 }
  }

  if (record.count >= rateLimit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((record.startTime + 60000 - now) / 1000))
    }
  }

  record.count++
  return { allowed: true, remaining: rateLimit - record.count }
}

export function checkPublicRateLimit(identifier, rateLimit) {
  return checkRateLimit('public', identifier, { limit: rateLimit })
}

export function checkPrivateRateLimit(identifier, rateLimit) {
  return checkRateLimit('private', identifier, { limit: rateLimit })
}

// 公共上传串行/并发控制：allowConcurrent=false 时同一 IP 同时只允许一个上传。
// （历史版本另有 privateApiConfig.maxConcurrent 私有并发控制，从未被接线，
//  v1.3.2 已连同配置字段一并移除，避免"可配置但不生效"的误导。）
export async function checkPublicConcurrency(identifier) {
  const config = await db.settings.findOne({ key: 'publicApiConfig' })
  if (!config?.value || config.value.allowConcurrent !== false) {
    return { allowed: true }
  }
  const key = `public:${identifier}`
  if (uploadingClients.has(key)) {
    return { allowed: false, message: '请等待上一项媒体上传完成' }
  }
  return { allowed: true }
}

export function acquirePublicConcurrency(identifier) {
  markUploadStart('public', identifier)
}

export function releasePublicConcurrency(identifier) {
  markUploadEnd('public', identifier)
}

export function markUploadStart(type, identifier) {
  const key = `${type}:${identifier}`
  const current = uploadingClients.get(key) || 0
  uploadingClients.set(key, current + 1)
}

export function markUploadEnd(type, identifier) {
  const key = `${type}:${identifier}`
  const current = uploadingClients.get(key) || 0
  if (current <= 1) {
    uploadingClients.delete(key)
  } else {
    uploadingClients.set(key, current - 1)
  }
}

export default {
  checkRateLimit,
  checkPublicConcurrency,
  markUploadStart,
  markUploadEnd
}
