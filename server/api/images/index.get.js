import { getAuthUser, isAdminUser, USER_ROLES } from '../../utils/auth.js'
import { listVisibleMedia, buildMediaResponse, resolveSiteUrl } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    // 分页参数夹取：limit 负值/超大值统一收敛到 [1,100]（回显与实际一致）
    const page = Math.max(1, parseInt(query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))
    const user = await getAuthUser(event)
    const siteUrl = await resolveSiteUrl(event)

    const result = await listVisibleMedia({ user, page, limit })
    const isAdmin = !!(user && isAdminUser(user))
    const items = result.items.map(item => {
      const resp = buildMediaResponse(item, siteUrl)
      // 账号枚举防护：非管理员且非本人视角下不回传真实用户名/用户ID
      if (!isAdmin && (!user || item.ownerId !== user._id)) {
        resp.ownerName = '用户'
        resp.uploadedBy = '用户'
        resp.ownerId = null
      }
      return resp
    })

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
