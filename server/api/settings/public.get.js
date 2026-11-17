import db from '../../utils/db.js'
import { DEFAULT_APP_SETTINGS } from '../../utils/appSettingsDefaults.js'

export default defineEventHandler(async (event) => {
  try {
    // 获取应用设置（公共部分，无需登录）
    const settings = await db.settings.findOne({ key: 'appSettings' })

    // 默认公告配置


    if (!settings) {
      return {
        success: true,
        data: {
          appName: DEFAULT_APP_SETTINGS.appName,
          appLogo: DEFAULT_APP_SETTINGS.appLogo,
          backgroundUrl: DEFAULT_APP_SETTINGS.backgroundUrl,
          backgroundBlur: DEFAULT_APP_SETTINGS.backgroundBlur,
          announcement: DEFAULT_APP_SETTINGS.announcement
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
        announcement: {
          ...DEFAULT_APP_SETTINGS.announcement,
          ...(settings.value.announcement || {})
        }
      }
    }
  } catch (error) {
    console.error('[Settings] 获取公共应用设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取设置失败'
    })
  }
})