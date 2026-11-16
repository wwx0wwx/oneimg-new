import crypto from 'crypto'
import db from './db.js'

/**
 * 敏感配置加密存储（AES-256-GCM）。
 * 主密钥从持久化的 jwtSecret（或 ONEIMG_SECRET_KEY 环境变量）派生，
 * 零额外配置；密文带 iv/tag/base64 前缀标记，兼容明文旧值（读取时自动识别）。
 */

const CIPHER = 'aes-256-gcm'
const MARKER = 'enc:v1:'

async function getMasterKey() {
  const envKey = process.env.ONEIMG_SECRET_KEY
  if (envKey && envKey.trim()) {
    return crypto.scryptSync(envKey.trim(), 'oneimg-secret-box', 32)
  }
  const setting = await db.settings.findOne({ key: 'jwtSecret' })
  if (!setting?.value) {
    throw new Error('缺少可用的主密钥源（ONEIMG_SECRET_KEY 或 jwtSecret）')
  }
  return crypto.scryptSync(setting.value, 'oneimg-secret-box', 32)
}

export async function encryptSecret(plain = '') {
  const text = String(plain ?? '')
  if (!text) return ''
  if (text.startsWith(MARKER)) return text // 已加密
  const key = await getMasterKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(CIPHER, key, iv)
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return MARKER + iv.toString('base64') + ':' + tag.toString('base64') + ':' + data.toString('base64')
}

export async function decryptSecret(stored = '') {
  const text = String(stored ?? '')
  if (!text) return ''
  if (!text.startsWith(MARKER)) return text // 兼容明文旧值
  try {
    const key = await getMasterKey()
    const [ivB64, tagB64, dataB64] = text.slice(MARKER.length).split(':')
    const decipher = crypto.createDecipheriv(CIPHER, key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    // 解密失败（如主密钥变更）按空处理，避免崩溃
    return ''
  }
}

// 脱敏展示：只保留尾 4 位
export function maskSecret(value = '') {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= 4) return '****'
  return '****' + text.slice(-4)
}

// 判断客户端提交的是否为脱敏占位（避免把掩码存回数据库）
export function isMaskedSecret(value = '') {
  const text = String(value ?? '')
  return text === '' || text === '****' || /^\*{4}.{0,4}$/.test(text)
}
