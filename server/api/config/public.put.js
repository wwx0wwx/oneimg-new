import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'
import { validateProviderConfig, getDefaultContentSafetyConfig } from '../../utils/moderation.js'

const DEFAULT_PUBLIC_CONFIG = {
  enabled: false,
  allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'tiff', 'mp4', 'webm', 'mov'],
  maxFileSize: 10 * 1024 * 1024,
  enableCompression: false,
  compressionQuality: 80,
  convertToWebp: false,
  convertToPng: false,
  rateLimit: 10,
  allowConcurrent: false,
  contentSafety: getDefaultContentSafetyConfig()
}

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const body = await readBody(event)
    const currentConfig = await db.settings.findOne({ key: 'publicApiConfig' })
    const previousValue = {
      ...DEFAULT_PUBLIC_CONFIG,
      ...(currentConfig?.value || {}),
      contentSafety: {
        ...getDefaultContentSafetyConfig(),
        ...(currentConfig?.value?.contentSafety || {})
      }
    }

    let contentSafetyConfig = previousValue.contentSafety

    if (body.contentSafety) {
      if (body.contentSafety.provider && body.contentSafety.providers?.[body.contentSafety.provider]) {
        const providerConfig = body.contentSafety.providers[body.contentSafety.provider]
        const validation = validateProviderConfig(body.contentSafety.provider, providerConfig)
        if (!validation.valid) {
          throw createError({
            statusCode: 400,
            message: validation.error
          })
        }
      }

      contentSafetyConfig = {
        ...previousValue.contentSafety,
        ...body.contentSafety,
        autoBlacklistIp: body.contentSafety.autoBlacklistIp === true,
        providers: body.contentSafety.providers || previousValue.contentSafety.providers
      }
    }

    const finalConvertToWebp = body.convertToWebp === true
    const finalConvertToPng = finalConvertToWebp ? false : (body.convertToPng === true)

    const configValue = {
      ...previousValue,
      enabled: body.enabled !== undefined ? body.enabled === true : previousValue.enabled,
      allowedFormats: Array.isArray(body.allowedFormats) && body.allowedFormats.length > 0 ? body.allowedFormats : previousValue.allowedFormats,
      maxFileSize: Number(body.maxFileSize) > 0 ? Number(body.maxFileSize) : previousValue.maxFileSize,
      enableCompression: body.enableCompression === true,
      compressionQuality: Number(body.compressionQuality) > 0 ? Number(body.compressionQuality) : previousValue.compressionQuality,
      convertToWebp: finalConvertToWebp,
      convertToPng: finalConvertToPng,
      rateLimit: Number(body.rateLimit) > 0 ? Number(body.rateLimit) : previousValue.rateLimit,
      allowConcurrent: body.allowConcurrent === true,
      contentSafety: contentSafetyConfig
    }

    await db.settings.update(
      { key: 'publicApiConfig' },
      {
        $set: {
          value: configValue,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    )

    return {
      success: true,
      message: '配置已保存',
      data: configValue
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Config] 更新公共 API 配置失败:', error)
    throw createError({
      statusCode: 500,
      message: '保存配置失败'
    })
  }
})
