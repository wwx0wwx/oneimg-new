import db from '../../utils/db.js'
import { getAuthUser, isAdminUser } from '../../utils/auth.js'
import { getDefaultContentSafetyConfig } from '../../utils/moderation.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await getAuthUser(event)
    const isAdmin = !!(user && isAdminUser(user))

    const config = await db.settings.findOne({ key: 'publicApiConfig' })
    // 注意：历史上此配置含 enabled/allowedFormats/maxFileSize 三个"死字段"——
    // 服务端校验从未使用它们（真实的匿名开关/格式/大小来自 mediaConfig）。
    // v1.3.1 起彻底移除，避免"总开关关闭但实际不生效"的误导。匿名上传策略
    // 统一在媒体策略（mediaConfig）中配置。
    const defaultConfig = {
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
    delete configData.enabled
    delete configData.allowedFormats
    delete configData.maxFileSize

    if (!isAdmin) {
      return {
        success: true,
        data: {
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
