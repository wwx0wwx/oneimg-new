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

    const config = await db.settings.findOne({ key: 'privateApiConfig' })

    return {
      success: true,
      data: {
        ...DEFAULT_PRIVATE_CONFIG,
        ...(config?.value || {})
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Config] 获取私有 API 配置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取配置失败'
    })
  }
})
