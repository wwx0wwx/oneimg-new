import { requireAdmin } from '../../utils/auth.js'
import { getNotificationConfigMasked } from '../../utils/notification.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const config = await getNotificationConfigMasked()

    return {
      success: true,
      data: config
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Notification] 获取通知配置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取通知配置失败'
    })
  }
})
