import db from '../../utils/db.js'
import { v4 as uuidv4 } from 'uuid'
import { requireAdmin } from '../../utils/auth.js'
import { generateApiKey, hashApiKey } from '../../utils/apiKeyHash.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const body = await readBody(event)
    const name = String(body.name || '').trim()
    const ownerUserId = String(body.ownerUserId || '').trim()

    if (!name) {
      throw createError({
        statusCode: 400,
        message: '请输入 API Key 名称'
      })
    }

    if (!ownerUserId) {
      throw createError({
        statusCode: 400,
        message: '请选择 API Key 归属用户'
      })
    }

    const ownerUser = await db.users.findOne({ _id: ownerUserId, status: { $ne: 'disabled' } })
    if (!ownerUser) {
      throw createError({
        statusCode: 400,
        message: '归属用户不存在或已被禁用'
      })
    }

    const apiKey = generateApiKey()  // 明文仅一次性返回
    const apiKeyHash = hashApiKey(apiKey)

    const newKey = {
      _id: uuidv4(),
      key: apiKeyHash,  // 库中存哈希
      name,
      isDefault: false,
      enabled: true,
      ownerUserId: ownerUser._id,
      ownerUsername: ownerUser.username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await db.apikeys.insert(newKey)

    return {
      success: true,
      message: 'API Key 创建成功',
      data: {
        id: newKey._id,
        key: newKey.key,
        name: newKey.name,
        isDefault: newKey.isDefault,
        enabled: newKey.enabled,
        ownerUserId: newKey.ownerUserId,
        ownerUsername: newKey.ownerUsername,
        createdAt: newKey.createdAt
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[ApiKeys] 创建 API Key 失败:', error)
    throw createError({
      statusCode: 500,
      message: '创建 API Key 失败'
    })
  }
})
