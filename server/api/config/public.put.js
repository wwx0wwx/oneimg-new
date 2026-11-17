import { requireAdmin } from '../../utils/auth.js'
import { validateProviderConfig, getDefaultContentSafetyConfig } from '../../utils/moderation.js'
import { getUploadPolicy, saveUploadPolicy, syncLegacyKeys } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const body = await readBody(event)
    const policy = await getUploadPolicy()

    let contentSafety = policy.contentSafety
    if (body.contentSafety) {
      if (body.contentSafety.provider && body.contentSafety.providers?.[body.contentSafety.provider]) {
        const providerConfig = body.contentSafety.providers[body.contentSafety.provider]
        const validation = validateProviderConfig(body.contentSafety.provider, providerConfig)
        if (!validation.valid) {
          throw createError({ statusCode: 400, message: validation.error })
        }
      }

      // 厂商密钥只允许来自服务端环境变量：客户端回传的 apiKey 一律剥离
      const stripProviderKeys = (providers = {}) => {
        const cleaned = {}
        for (const [key, value] of Object.entries(providers || {})) {
          if (value && typeof value === 'object') {
            cleaned[key] = { ...value, apiKey: '' }
          }
        }
        return cleaned
      }

      // 部分提交时与现有配置合并，避免其余厂商配置被静默丢弃
      contentSafety = {
        ...getDefaultContentSafetyConfig(),
        ...policy.contentSafety,
        ...body.contentSafety,
        autoBlacklistIp: body.contentSafety.autoBlacklistIp === true,
        providers: stripProviderKeys({ ...(policy.contentSafety?.providers || {}), ...body.contentSafety.providers })
      }
    }

    const next = {
      ...policy,
      processing: {
        enableCompression: body.enableCompression === true,
        quality: Number(body.compressionQuality) > 0 ? Number(body.compressionQuality) : policy.processing.quality,
        convertTo: (body.convertToPng === true) ? 'png' : (body.convertToWebp === true ? 'webp' : 'none')
      },
      limits: {
        ...policy.limits,
        anonymousPerMin: Number(body.rateLimit) > 0 ? Math.round(Number(body.rateLimit)) : policy.limits.anonymousPerMin
      },
      allowConcurrent: body.allowConcurrent === true,
      contentSafety
    }

    const saved = await saveUploadPolicy(next)
    await syncLegacyKeys(saved)

    // 响应保持历史形状
    return {
      success: true,
      message: '配置已保存',
      data: {
        enableCompression: saved.processing.enableCompression,
        compressionQuality: saved.processing.quality,
        convertToWebp: saved.processing.convertTo === 'webp',
        convertToPng: saved.processing.convertTo === 'png',
        rateLimit: saved.limits.anonymousPerMin,
        allowConcurrent: saved.allowConcurrent,
        contentSafety: saved.contentSafety
      }
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('[Config] 更新公共 API 配置失败:', error)
    throw createError({ statusCode: 500, message: '保存配置失败' })
  }
})
