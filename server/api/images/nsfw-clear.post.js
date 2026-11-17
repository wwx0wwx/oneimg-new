import { requireAdmin } from '../../utils/auth.js'
import { purgeMedia } from '../../utils/mediaService.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const { deletedCount, errors } = await purgeMedia({ isNsfw: true })

    return {
      success: true,
      message: deletedCount > 0 ? `成功清空 ${deletedCount} 个违规媒体项` : '没有需要清空的违规媒体',
      data: {
        deletedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Media] 清空违规媒体失败:', error)
    throw createError({
      statusCode: 500,
      message: '清空违规媒体失败'
    })
  }
})
