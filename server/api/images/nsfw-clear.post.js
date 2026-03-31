import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'
import { deleteMediaFile } from '../../utils/media.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  try {
    const nsfwMedia = await db.images.find({ isNsfw: true })

    if (nsfwMedia.length === 0) {
      return {
        success: true,
        message: '没有需要清空的违规媒体',
        data: { deletedCount: 0 }
      }
    }

    let deletedCount = 0
    const errors = []

    for (const media of nsfwMedia) {
      try {
        deleteMediaFile(media.filename)
        await db.images.remove({ _id: media._id })
        deletedCount++
      } catch (err) {
        console.error(`删除违规媒体失败 ${media.uuid}:`, err)
        errors.push(media.uuid)
      }
    }

    return {
      success: true,
      message: `成功清空 ${deletedCount} 个违规媒体项`,
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
