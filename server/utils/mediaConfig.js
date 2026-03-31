import { v4 as uuidv4 } from 'uuid'
import db from './db.js'
import { ALL_MEDIA_FORMATS, normalizeExtension } from './media.js'
import { USER_ROLES } from './auth.js'

export const DEFAULT_MEDIA_CONFIG = {
  allowAnonymousUpload: false,
  allowedExtensions: ALL_MEDIA_FORMATS,
  anonymousMaxFileSize: 10 * 1024 * 1024,
  userMaxFileSize: 50 * 1024 * 1024,
  adminMaxFileSize: 100 * 1024 * 1024,
  defaultUserVisibility: 'private'
}


function normalizeAllowedExtensions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_MEDIA_CONFIG.allowedExtensions
  }

  const normalized = [...new Set(value.map(item => normalizeExtension(item)).filter(Boolean))]
  const valid = normalized.filter(item => ALL_MEDIA_FORMATS.includes(item))
  return valid.length > 0 ? valid : DEFAULT_MEDIA_CONFIG.allowedExtensions
}

function normalizeMaxSize(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback
  }
  return Math.round(numeric)
}

function normalizeVisibility(value) {
  return value === 'public' ? 'public' : 'private'
}

export function normalizeMediaConfig(value = {}) {
  return {
    allowAnonymousUpload: value.allowAnonymousUpload === true,
    allowedExtensions: normalizeAllowedExtensions(value.allowedExtensions),
    anonymousMaxFileSize: normalizeMaxSize(value.anonymousMaxFileSize, DEFAULT_MEDIA_CONFIG.anonymousMaxFileSize),
    userMaxFileSize: normalizeMaxSize(value.userMaxFileSize, DEFAULT_MEDIA_CONFIG.userMaxFileSize),
    adminMaxFileSize: normalizeMaxSize(value.adminMaxFileSize, DEFAULT_MEDIA_CONFIG.adminMaxFileSize),
    defaultUserVisibility: normalizeVisibility(value.defaultUserVisibility)
  }
}

export async function getMediaConfig() {
  const config = await db.settings.findOne({ key: 'mediaConfig' })
  return normalizeMediaConfig({
    ...DEFAULT_MEDIA_CONFIG,
    ...(config?.value || {})
  })
}

export async function saveMediaConfig(value = {}) {
  const merged = normalizeMediaConfig({
    ...DEFAULT_MEDIA_CONFIG,
    ...value
  })

  await db.settings.update(
    { key: 'mediaConfig' },
    {
      $set: {
        _id: uuidv4(),
        key: 'mediaConfig',
        value: merged,
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  )

  return merged
}

export function getMaxFileSizeForRole(config, role = USER_ROLES.ANONYMOUS) {
  if (role === USER_ROLES.ADMIN) return config.adminMaxFileSize
  if (role === USER_ROLES.USER) return config.userMaxFileSize
  return config.anonymousMaxFileSize
}
