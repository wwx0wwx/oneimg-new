import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'

const DEFAULT_PRIVATE_CONFIG = {
  maxFileSize: 50 * 1024 * 1024,
  enableCompression: false,
  compressionQuality: 80,
  convertToWebp: false,
  convertToPng: false,
  rateLimit: 60,
  maxConcurrent: 2,
  showOnHomepage: false
}

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)
    const currentConfig = await db.settings.findOne({ key: 'privateApiConfig' })
    const previousValue = {
      ...DEFAULT_PRIVATE_CONFIG,
      ...(currentConfig?.value || {})
    }

    const finalConvertToWebp = body.convertToWebp === true
    const finalConvertToPng = finalConvertToWebp ? false : (body.convertToPng === true)

    const configValue = {
      ...previousValue,
      maxFileSize: Number(body.maxFileSize) > 0 ? Number(body.maxFileSize) : previousValue.maxFileSize,
      enableCompression: body.enableCompression === true,
      compressionQuality: Number(body.compressionQuality) > 0 ? Number(body.compressionQuality) : previousValue.compressionQuality,
      convertToWebp: finalConvertToWebp,
      convertToPng: finalConvertToPng,
      rateLimit: Number(body.rateLimit) > 0 ? Number(body.rateLimit) : previousValue.rateLimit,
      maxConcurrent: Number(body.maxConcurrent) > 0 ? Number(body.maxConcurrent) : previousValue.maxConcurrent,
      showOnHomepage: body.showOnHomepage === true
    }

    await db.settings.update(
      { key: 'privateApiConfig' },
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

    console.error('[Config] 更新私有 API 配置失败:', error)
    throw createError({
      statusCode: 500,
      message: '保存配置失败'
    })
  }
})
