import db from '../../utils/db.js'
import { parseFormData } from '../../utils/media.js'
import {
  checkPublicRateLimit,
  checkPublicConcurrency,
  acquirePublicConcurrency,
  releasePublicConcurrency
} from '../../utils/rateLimit.js'
import { sendUploadNotification } from '../../utils/notification/index.js'
import { assertAnonymousUploadAllowed, createMediaRecord, validateMediaByConfig } from '../../utils/mediaService.js'
import { USER_ROLES } from '../../utils/auth.js'
import { getUploadPolicy, processingToFlat } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  // 并发计数只有 acquire 过才允许 release，避免计数漂移
  let concurrencyAcquired = false

  try {
    const policy = await assertAnonymousUploadAllowed(event)
    const mediaConfig = policy
    const uploadConfig = {
      ...processingToFlat(policy.processing),
      contentSafety: policy.contentSafety
    }

    const rateLimitResult = await checkPublicRateLimit(clientIP, policy.limits.anonymousPerMin)
    if (!rateLimitResult.allowed) {
      throw createError({ statusCode: 429, message: `请求过于频繁，请 ${rateLimitResult.retryAfter ?? 60} 秒后重试` })
    }

    if (!policy.allowConcurrent) {
      const concurrencyResult = await checkPublicConcurrency(clientIP)
      if (!concurrencyResult.allowed) {
        throw createError({ statusCode: 429, message: '请等待上一项媒体上传完成' })
      }
      acquirePublicConcurrency(clientIP)
      concurrencyAcquired = true
    }

    const { file } = await parseFormData(event)
    if (!file) {
      throw createError({ statusCode: 400, message: '请选择要上传的媒体文件' })
    }

    await validateMediaByConfig({
      file,
      role: USER_ROLES.ANONYMOUS,
      config: mediaConfig,
      allowAnonymousUpload: mediaConfig.allowAnonymousUpload
    })

    const { record, response } = await createMediaRecord({
      event,
      file,
      owner: { id: null, name: '匿名用户', role: USER_ROLES.ANONYMOUS },
      uploadedByType: 'public',
      visibility: 'public',
      uploadConfig,
      enableModeration: uploadConfig.contentSafety?.enabled === true
    })

    if (concurrencyAcquired) {
      releasePublicConcurrency(clientIP)
    }

    sendUploadNotification(
      {
        id: record._id,
        filename: record.filename,
        format: record.format,
        size: record.size,
        url: response.fullUrl
      },
      {
        name: '匿名用户',
        type: record.mediaType,
        ip: clientIP
      }
    ).catch(err => {
      console.error('[Upload] 发送上传通知失败:', err)
    })

    return {
      success: true,
      message: '上传成功',
      data: response
    }
  } catch (error) {
    if (concurrencyAcquired) {
      releasePublicConcurrency(clientIP)
    }

    if (error.statusCode) {
      throw error
    }

    console.error('[Upload] 公共上传失败:', error)
    throw createError({
      statusCode: 500,
      message: '上传失败，请稍后重试'
    })
  }
})
