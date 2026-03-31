import { requireAdmin } from '../../utils/auth.js'
import { removeFromBlacklistById } from '../../utils/ipBlacklist.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        message: '缺少 ID 参数'
      })
    }

    const result = await removeFromBlacklistById(id)
    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: result.error
      })
    }

    return {
      success: true,
      message: `IP ${result.ip} 已从黑名单中移除`
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Blacklist] 移除黑名单失败:', error)
    throw createError({
      statusCode: 500,
      message: '移除黑名单失败'
    })
  }
})
