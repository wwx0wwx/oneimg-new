import { requireAdmin } from '../../utils/auth.js'
import { getBlacklist } from '../../utils/ipBlacklist.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const query = getQuery(event)
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 20
    const result = await getBlacklist({ page, limit })

    return {
      success: true,
      data: result
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Blacklist] 获取黑名单列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取黑名单列表失败'
    })
  }
})
