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

export async function checkRateLimit(type, identifier) {
  const configKey = type === 'public' ? 'publicApiConfig' : 'privateApiConfig'
  const config = await db.settings.findOne({ key: configKey })

  if (!config?.value?.rateLimit) {
    return { allowed: true }
  }

  const rateLimit = config.value.rateLimit
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
      retryAfter: Math.ceil((record.startTime + 60000 - now) / 1000)
    }
  }

  record.count++
  return { allowed: true, remaining: rateLimit - record.count }
}

export function checkPublicRateLimit(identifier, rateLimit) {
  return checkRateLimit('public', identifier)
}

export function checkPrivateRateLimit(identifier, rateLimit) {
  return checkRateLimit('private', identifier)
}

export async function checkConcurrency(type, identifier) {
  const configKey = type === 'public' ? 'publicApiConfig' : 'privateApiConfig'
  const config = await db.settings.findOne({ key: configKey })

  if (!config?.value) {
    return { allowed: true }
  }

  const key = `${type}:${identifier}`

  if (type === 'public') {
    if (!config.value.allowConcurrent && uploadingClients.has(key)) {
      return { allowed: false, message: '请等待上一张图片上传完成' }
    }
  } else {
    const maxConcurrent = config.value.maxConcurrent || 2
    const currentCount = uploadingClients.get(key) || 0
    if (currentCount >= maxConcurrent) {
      return { allowed: false, message: `并发上传数已达上限 (${maxConcurrent})` }
    }
  }

  return { allowed: true }
}

export function checkPublicConcurrency(identifier) {
  return checkConcurrency('public', identifier)
}

export function checkPrivateConcurrency(identifier) {
  return checkConcurrency('private', identifier)
}

export function acquirePublicConcurrency(identifier) {
  markUploadStart('public', identifier)
}

export function releasePublicConcurrency(identifier) {
  markUploadEnd('public', identifier)
}

export function acquirePrivateConcurrency(identifier) {
  markUploadStart('private', identifier)
}

export function releasePrivateConcurrency(identifier) {
  markUploadEnd('private', identifier)
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
  checkConcurrency,
  markUploadStart,
  markUploadEnd
}
