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
    const secret = crypto.randomBytes(64).toString('hex')
    const now = new Date().toISOString()
    await db.settings.update(
      { key: 'jwtSecret' },
      {
        $set: {
          key: 'jwtSecret',
          value: secret,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    )
    return secret
  }

  return setting.value
}

// 生成 Token
export async function generateToken(payload) {
  const secret = await getJwtSecret()
  const normalizedPayload = {
    ...payload,
    role: normalizeUserRole(payload.role || USER_ROLES.USER)
  }
  return jwt.sign(normalizedPayload, secret, { expiresIn: '30d' })
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
    return {
      ...decoded,
      role: normalizeUserRole(user.role || decoded.role || USER_ROLES.USER),
      username: user.username
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
