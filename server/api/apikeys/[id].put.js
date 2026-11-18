import db from '../../utils/db.js'
import { v4 as uuidv4 } from 'uuid'
import { requireAdmin } from '../../utils/auth.js'
import { generateApiKey, hashApiKey } from '../../utils/apiKeyHash.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        message: '缺少 API Key ID'
      })
    }

    const apiKey = await db.apikeys.findOne({ _id: id })
    if (!apiKey) {
      throw createError({
        statusCode: 404,
        message: 'API Key 不存在'
      })
    }

    const body = await readBody(event)
    const { name, enabled, regenerate, ownerUserId } = body
    const updateData = {
      updatedAt: new Date().toISOString()
    }

    if (name !== undefined) {
      const nextName = String(name || '').trim()
      if (!nextName) {
        throw createError({ statusCode: 400, message: 'API Key 名称不能为空' })
      }
      updateData.name = nextName
    }

    if (enabled !== undefined) {
      updateData.enabled = enabled === true
    }

    if (ownerUserId !== undefined) {
      // 允许显式传 null 解绑归属（此前 String(null)='null' 导致无法解绑且报错误导）
      if (ownerUserId === null || ownerUserId === '') {
        updateData.ownerUserId = null
        updateData.ownerUsername = null
      } else {
        const ownerUser = await db.users.findOne({ _id: String(ownerUserId), status: { $ne: 'disabled' } })
        if (!ownerUser) {
          throw createError({ statusCode: 400, message: '归属用户不存在或已被禁用' })
        }
        updateData.ownerUserId = ownerUser._id
        updateData.ownerUsername = ownerUser.username
      }
    }

    let newKey = null
    if (regenerate) {
      newKey = generateApiKey()
      updateData.key = hashApiKey(newKey)  // 库中存哈希
    }

    await db.apikeys.update({ _id: id }, { $set: updateData })
    const updatedKey = await db.apikeys.findOne({ _id: id })

    // 仅重新生成时一次性返回完整 key（日常更新掩码回显）
    const shouldRevealKey = regenerate === true
    // regenerate 时返回刚生成的明文（updateData 中存的是哈希，明文只在本次响应中出现）
    const maskedKey = updatedKey.key ? updatedKey.key.slice(0, 7) + '****' + updatedKey.key.slice(-4) : updatedKey.key
    return {
      success: true,
      message: 'API Key 更新成功',
      data: {
        id: updatedKey._id,
        key: shouldRevealKey ? newKey : maskedKey,
        name: updatedKey.name,
        isDefault: updatedKey.isDefault,
        enabled: updatedKey.enabled,
        ownerUserId: updatedKey.ownerUserId || null,
        ownerUsername: updatedKey.ownerUsername || null,
        createdAt: updatedKey.createdAt,
        updatedAt: updatedKey.updatedAt
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[ApiKeys] 更新 API Key 失败:', error)
    throw createError({
      statusCode: 500,
      message: '更新 API Key 失败'
    })
  }
})
