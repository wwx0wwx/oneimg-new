import { requireAdmin } from '../../utils/auth.js'
import { getMediaStats } from '../../utils/mediaService.js'

let statsCache = null
let statsCacheTime = 0
const CACHE_TTL = 60 * 1000

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const now = Date.now()
    const forceRefresh = getQuery(event).refresh === 'true'

    if (!forceRefresh && statsCache && (now - statsCacheTime) < CACHE_TTL) {
      return {
        success: true,
        data: statsCache,
        cached: true
      }
    }

    const stats = await getMediaStats()
    statsCache = stats
    statsCacheTime = now

    return {
      success: true,
      data: stats,
      cached: false
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Settings] 获取统计数据失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取统计数据失败'
    })
  }
})

