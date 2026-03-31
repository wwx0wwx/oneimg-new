import db from '../../utils/db.js'
import { getAuthUser, isAdminUser } from '../../utils/auth.js'
import { getDefaultContentSafetyConfig } from '../../utils/moderation.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await getAuthUser(event)
    const isAdmin = !!(user && isAdminUser(user))

    const config = await db.settings.findOne({ key: 'publicApiConfig' })
    const defaultConfig = {
      enabled: false,
      allowedFormats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'tiff', 'tif', 'mp4', 'webm', 'mov'],
      maxFileSize: 10 * 1024 * 1024,
      enableCompression: false,
      compressionQuality: 80,
      convertToWebp: false,
      convertToPng: false,
      rateLimit: 10,
      allowConcurrent: false,
      contentSafety: getDefaultContentSafetyConfig()
    }

    const configData = {
      ...defaultConfig,
      ...(config?.value || {}),
      contentSafety: {
        ...getDefaultContentSafetyConfig(),
        ...(config?.value?.contentSafety || {})
      }
    }

    if (!isAdmin) {
      return {
        success: true,
        data: {
          enabled: configData.enabled,
          allowedFormats: configData.allowedFormats,
          maxFileSize: configData.maxFileSize,
          allowConcurrent: configData.allowConcurrent
        }
      }
    }

    return {
      success: true,
      data: configData
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Config] 获取公共 API 配置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取配置失败'
    })
  }
})
