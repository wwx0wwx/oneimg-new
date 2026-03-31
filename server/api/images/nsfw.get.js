import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'
import { buildMediaResponse, resolveSiteUrl } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const query = getQuery(event)
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 20
    const skip = (page - 1) * limit
    const queryCondition = { isNsfw: true }
    const total = await db.images.count(queryCondition)
    let mediaList = await db.images.find(queryCondition)
    const siteUrl = await resolveSiteUrl(event)

    mediaList.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    mediaList = mediaList.slice(skip, skip + limit)

    const items = mediaList.map(item => ({
      ...buildMediaResponse(item, siteUrl),
      previewUrl: `/api/images/preview/${item.uuid}.${item.format}`,
      moderationCategories: item.moderationResult?.categories || null
    }))

    return {
      success: true,
      data: {
        media: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }
  } catch (error) {
    console.error('[Media] 获取违规媒体列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取违规媒体列表失败'
    })
  }
})
