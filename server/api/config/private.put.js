import { requireAdmin } from '../../utils/auth.js'
import { getUploadPolicy, saveUploadPolicy } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const body = await readBody(event)
    const policy = await getUploadPolicy()

    // 入参保持历史形状；maxFileSize/showOnHomepage 为已移除的死字段，静默忽略
    const next = {
      ...policy,
      processing: {
        enableCompression: body.enableCompression === true,
        quality: Number(body.compressionQuality) > 0 ? Number(body.compressionQuality) : policy.processing.quality,
        convertTo: (body.convertToPng === true) ? 'png' : (body.convertToWebp === true ? 'webp' : 'none')
      },
      limits: {
        ...policy.limits,
        authenticatedPerMin: Number(body.rateLimit) > 0 ? Math.round(Number(body.rateLimit)) : policy.limits.authenticatedPerMin
      }
    }

    const saved = await saveUploadPolicy(next)

    return {
      success: true,
      message: '配置已保存',
      data: {
        enableCompression: saved.processing.enableCompression,
        compressionQuality: saved.processing.quality,
        convertToWebp: saved.processing.convertTo === 'webp',
        convertToPng: saved.processing.convertTo === 'png',
        rateLimit: saved.limits.authenticatedPerMin
      }
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('[Config] 更新私有 API 配置失败:', error)
    throw createError({ statusCode: 500, message: '保存配置失败' })
  }
})
