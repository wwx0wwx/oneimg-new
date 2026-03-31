import { getAuthUser, isAdminUser, USER_ROLES } from '../../utils/auth.js'
import { listVisibleMedia, buildMediaResponse, resolveSiteUrl } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 20
    const user = await getAuthUser(event)
    const siteUrl = await resolveSiteUrl(event)

    const result = await listVisibleMedia({ user, page, limit })
    const items = result.items.map(item => buildMediaResponse(item, siteUrl))

    return {
      success: true,
      data: {
        media: items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        },
        currentUserRole: user ? (user.role || USER_ROLES.USER) : USER_ROLES.ANONYMOUS,
        isAdmin: !!(user && isAdminUser(user))
      }
    }
  } catch (error) {
    console.error('[Media] 获取媒体列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取媒体列表失败'
    })
  }
})
