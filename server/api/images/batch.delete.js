import { requireAdmin } from '../../utils/auth.js'
import { batchSoftDeleteMedia } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAdmin(event)
    const body = await readBody(event)
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(Boolean))] : []

    if (ids.length === 0) {
      throw createError({
        statusCode: 400,
        message: '请选择要删除的媒体'
      })
    }

    const result = await batchSoftDeleteMedia({ ids, user })

    return {
      success: true,
      message: `成功删除 ${result.deletedCount} 个媒体项`,
      data: result
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Media] 批量删除媒体失败:', error)
    throw createError({
      statusCode: 500,
      message: '批量删除媒体失败'
    })
  }
})
