import { requireAuthUser } from '../../utils/auth.js'
import { softDeleteMedia } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        message: '缺少媒体 ID'
      })
    }

    await softDeleteMedia({ id, user })

    return {
      success: true,
      message: '删除成功'
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Images] 删除媒体失败:', error)
    throw createError({
      statusCode: 500,
      message: '删除媒体失败'
    })
  }
})
