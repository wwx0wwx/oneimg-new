import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'

function serializeApiKey(key = {}) {
  return {
    id: key._id,
    key: key.key,
    name: key.name,
    isDefault: key.isDefault || false,
    enabled: key.enabled !== false,
    ownerUserId: key.ownerUserId || null,
    ownerUsername: key.ownerUsername || null,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt
  }
}

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const apiKeys = await db.apikeys.find({})
    apiKeys.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    return {
      success: true,
      data: apiKeys.map(serializeApiKey)
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[ApiKeys] 获取 ApiKey 列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取 ApiKey 列表失败'
    })
  }
})
