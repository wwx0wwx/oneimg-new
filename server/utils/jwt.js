import jwt from 'jsonwebtoken'
import { db } from './db.js'
import crypto from 'crypto'
import { USER_ROLES, normalizeUserRole } from './auth.js'

// 获取或生成 JWT 密钥（单机部署：优先环境变量，其次持久化到数据库）
export async function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET.trim()
  }

  let setting = await db.settings.findOne({ key: 'jwtSecret' })

  if (!setting?.value) {
    // NeDB 不支持 $setOnInsert——改用 insert（并发下 findOne 兜底保证幂等）
    const secret = crypto.randomBytes(64).toString('hex')
    const now = new Date().toISOString()
    await db.settings.insert({ key: 'jwtSecret', value: secret, createdAt: now, updatedAt: now })
    return secret
  }

  return setting.value
}

// 生成 Token
// - 有效期从 30 天缩短为 7 天
// - 携带 tokenVersion（tv）：修改密码/用户名、管理员重置密码会递增该版本，
//   旧 token 立即失效（登出、改密后无法继续使用已泄露的旧 token）
export async function generateToken(payload) {
  const secret = await getJwtSecret()

  let tokenVersion = 1
  if (payload.userId) {
    const user = await db.users.findOne({ _id: payload.userId })
    tokenVersion = user?.tokenVersion || 1
  }

  const normalizedPayload = {
    ...payload,
    role: normalizeUserRole(payload.role || USER_ROLES.USER),
    tv: tokenVersion
  }
  return jwt.sign(normalizedPayload, secret, { expiresIn: '7d' })
}

// 验证 Token
export async function verifyToken(token) {
  try {
    const secret = await getJwtSecret()
    const decoded = jwt.verify(token, secret)
    if (!decoded?.userId) {
      return null
    }
    const user = await db.users.findOne({ _id: decoded.userId, status: { $ne: 'disabled' } })
    if (!user) {
      return null
    }
    // tokenVersion 不匹配 = 签发后发生过改密/改名/密码重置，旧 token 撤销
    if ((decoded.tv || 1) !== (user.tokenVersion || 1)) {
      return null
    }
    // 附带调用方常用的用户字段，使 getAuthUser 无需二次查库。
    // tokenVersion 取库文档真值——撤销侧（改密/改名/重置）以它为基准 +1；
    // 历史上撤销侧误用 decoded（只有 tv 声明）导致第 2 次起改密不再撤销
    return {
      ...decoded,
      role: normalizeUserRole(user.role || decoded.role || USER_ROLES.USER),
      username: user.username,
      tokenVersion: user.tokenVersion || 1,
      _id: user._id,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt || null,
      requirePasswordChange: !!user.requirePasswordChange
    }
  } catch (error) {
    return null
  }
}

// 从请求头中提取 Token
export function extractToken(event) {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}
