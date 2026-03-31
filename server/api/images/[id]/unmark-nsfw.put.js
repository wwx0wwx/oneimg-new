import db from '../../../utils/db.js'
import { requireAdmin } from '../../../utils/auth.js'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        message: '缺少媒体 ID'
      })
    }

    const media = await db.images.findOne({ _id: id })
    if (!media) {
      throw createError({
        statusCode: 404,
        message: '媒体不存在'
      })
    }

    if (!media.isNsfw) {
      return {
        success: true,
        message: '该媒体未被标记为违规'
      }
    }

    const updateData = {
      isNsfw: false,
      moderationStatus: 'unmarked_by_admin',
      unmarkedAt: new Date().toISOString(),
      unmarkedBy: admin.username,
      updatedAt: new Date().toISOString()
    }

    if (media.isDeleted) {
      updateData.isDeleted = false
      updateData.deletedAt = null
      updateData.deletedBy = null
    }

    await db.images.update(
      { _id: id },
      { $set: updateData }
    )

    return {
      success: true,
      message: media.isDeleted ? '已取消违规标记并恢复媒体' : '已取消违规标记',
      data: {
        restored: media.isDeleted
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Media] 取消违规标记失败:', error)
    throw createError({
      statusCode: 500,
      message: '取消违规标记失败'
    })
  }
})
