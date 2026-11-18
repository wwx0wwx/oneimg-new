import crypto from 'crypto'

/**
 * API Key 哈希存储：
 * 库中只存 SHA-256 哈希（数据库文件泄漏时上传凭证不可直接使用）。
 * 完整明文 key 仅在创建/重新生成响应中一次性返回。
 * 验证时用 hash(apiKey) 查库匹配。
 */

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex')
}

export function generateApiKey() {
  return `sk-${crypto.randomBytes(24).toString('hex')}`
}

/**
 * 启动迁移：检测 apikeys.db 中是否有明文 key（不以 sha256 hex 64 位存储），
 * 就地替换为哈希值。幂等——已哈希的 key（64 hex chars）跳过。
 */
export async function migrateApiKeysToHash(db) {
  const keys = await db.apikeys.find({})
  let migrated = 0
  for (const doc of keys) {
    if (doc.key && doc.key.length !== 64) {
      await db.apikeys.update(
        { _id: doc._id },
        { $set: { key: hashApiKey(doc.key) } }
      )
      migrated++
    }
  }
  if (migrated > 0) {
    console.log(`[ApiKeyHash] 已将 ${migrated} 个明文 key 迁移为 SHA-256 哈希`)
  }
  return migrated
}
