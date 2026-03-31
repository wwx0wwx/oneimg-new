import { requireAdmin } from '../../utils/auth.js'
import { hardDeleteDeletedMedia } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const result = await hardDeleteDeletedMedia()

    return {
      success: true,
      message: `成功硬删除 ${result.deletedCount} 个媒体项`,
      data: {
        deletedCount: result.deletedCount,
        errors: result.errors.length > 0 ? result.errors : undefined
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Settings] 硬删除媒体失败:', error)
    throw createError({
      statusCode: 500,
      message: '硬删除媒体失败'
    })
  }
})
