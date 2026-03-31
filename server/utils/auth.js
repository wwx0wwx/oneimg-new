import db from './db.js'
import { verifyToken, extractToken } from './jwt.js'

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  ANONYMOUS: 'anonymous'
}

export const MEDIA_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private'
}

export function normalizeUserRole(role = USER_ROLES.USER) {
  return role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.USER
}

export function sanitizeUser(user = {}) {
  return {
    id: user._id,
    username: user.username,
    role: normalizeUserRole(user.role),
    status: user.status || 'active',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null
  }
}

export async function getAuthUser(event) {
  const token = extractToken(event)
  if (!token) return null
  const decoded = await verifyToken(token)
  if (!decoded?.userId) return null
  const user = await db.users.findOne({ _id: decoded.userId, status: { $ne: 'disabled' } })
  return user || null
}

export async function requireAuthUser(event) {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: '未登录或登录已失效' })
  }
  event.context.authUser = user
  return user
}

export async function requireAdmin(event) {
  const user = await requireAuthUser(event)
  if (normalizeUserRole(user.role) !== USER_ROLES.ADMIN) {
    throw createError({ statusCode: 403, message: '需要管理员权限' })
  }
  return user
}

export function isAdminUser(user = {}) {
  return normalizeUserRole(user.role) === USER_ROLES.ADMIN
}

export function getActorFromUser(user = null) {
  if (!user) {
    return {
      id: null,
      username: '匿名用户',
      role: USER_ROLES.ANONYMOUS
    }
  }

  return {
    id: user._id,
    username: user.username,
    role: normalizeUserRole(user.role)
  }
}

export function getMediaOwnerFromUser(user = null) {
  const actor = getActorFromUser(user)
  return {
    id: actor.id,
    name: actor.username,
    role: actor.role
  }
}

export function canManageMedia(user, media) {
  if (!user || !media) return false
  if (isAdminUser(user)) return true
  return !!media.ownerId && media.ownerId === user._id
}

export function canViewMedia(user, media) {
  if (!media || media.isDeleted || media.isNsfw) return false
  if (media.visibility !== MEDIA_VISIBILITY.PRIVATE) return true
  if (!user) return false
  return isAdminUser(user) || media.ownerId === user._id
}

export function resolveUploadRole(user = null) {
  if (!user) return USER_ROLES.ANONYMOUS
  return isAdminUser(user) ? USER_ROLES.ADMIN : USER_ROLES.USER
}

