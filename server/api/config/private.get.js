import { requireAdmin } from '../../utils/auth.js'
import { getUploadPolicy, processingToFlat } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const policy = await getUploadPolicy()

    // 视图保持历史 privateApiConfig 形状。
    // 历史死字段 maxFileSize/showOnHomepage 已随 v2.1.0 移除（无服务端消费方）。
    return {
      success: true,
      data: {
        ...processingToFlat(policy.processing),
        rateLimit: policy.limits.authenticatedPerMin
      }
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('[Config] 获取私有 API 配置失败:', error)
    throw createError({ statusCode: 500, message: '获取配置失败' })
  }
})
