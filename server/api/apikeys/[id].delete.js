import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'

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

    if (apiKey.isDefault) {
      throw createError({
        statusCode: 400,
        message: '默认 API Key 不能删除，只能更新'
      })
    }

    await db.apikeys.remove({ _id: id })

    return {
      success: true,
      message: 'API Key 删除成功'
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[ApiKeys] 删除 API Key 失败:', error)
    throw createError({
      statusCode: 500,
      message: '删除 API Key 失败'
    })
  }
})
