import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const settings = await db.settings.findOne({ key: 'appSettings' })
    const deletedCount = await db.images.count({ isDeleted: true })

    const defaultAnnouncement = {
      enabled: false,
      content: '',
      displayType: 'modal'
    }

    if (!settings) {
      return {
        success: true,
        data: {
          appName: 'OneImg',
          appLogo: '',
          backgroundUrl: '',
          backgroundBlur: 0,
          siteUrl: '',
          appDescription: 'OneImg 是一个面向个人使用的媒体床，统一管理图片与视频。',
          deletedImagesCount: deletedCount,
          announcement: defaultAnnouncement
        }
      }
    }

    return {
      success: true,
      data: {
        appName: settings.value.appName || 'OneImg',
        appLogo: settings.value.appLogo || '',
        backgroundUrl: settings.value.backgroundUrl || '',
        backgroundBlur: settings.value.backgroundBlur || 0,
        siteUrl: settings.value.siteUrl || '',
        appDescription: settings.value.appDescription || 'OneImg 是一个面向个人使用的媒体床，统一管理图片与视频。',
        deletedImagesCount: deletedCount,
        announcement: {
          ...defaultAnnouncement,
          ...(settings.value.announcement || {})
        }
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Settings] 获取应用设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取设置失败'
    })
  }
})
