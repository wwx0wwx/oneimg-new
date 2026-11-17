import { getAuthUser, isAdminUser } from '../../utils/auth.js'
import { getUploadPolicy, processingToFlat } from '../../utils/uploadPolicy.js'
import { getDefaultContentSafetyConfig } from '../../utils/moderation.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await getAuthUser(event)
    const isAdmin = !!(user && isAdminUser(user))
    const policy = await getUploadPolicy()

    // 视图保持历史 publicApiConfig 形状（enableCompression/compressionQuality/
    // convertToWebp/convertToPng/rateLimit/allowConcurrent/contentSafety）
    const view = {
      ...processingToFlat(policy.processing),
      rateLimit: policy.limits.anonymousPerMin,
      allowConcurrent: policy.allowConcurrent,
      contentSafety: {
        ...getDefaultContentSafetyConfig(),
        ...(policy.contentSafety || {})
      }
    }

    if (!isAdmin) {
      return { success: true, data: { allowConcurrent: view.allowConcurrent } }
    }
    return { success: true, data: view }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('[Config] 获取公共 API 配置失败:', error)
    throw createError({ statusCode: 500, message: '获取配置失败' })
  }
})
