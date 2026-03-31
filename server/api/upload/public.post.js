import db from '../../utils/db.js'
import { parseFormData } from '../../utils/media.js'
import {
  checkPublicRateLimit,
  checkPublicConcurrency,
  acquirePublicConcurrency,
  releasePublicConcurrency
} from '../../utils/rateLimit.js'
import { sendUploadNotification } from '../../utils/notification.js'
import { assertAnonymousUploadAllowed, createMediaRecord, validateMediaByConfig } from '../../utils/mediaService.js'
import { USER_ROLES } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

  try {
    const mediaConfig = await assertAnonymousUploadAllowed(event)
    const publicConfigDoc = await db.settings.findOne({ key: 'publicApiConfig' })
    const uploadConfig = publicConfigDoc?.value || {}

    const rateLimitResult = checkPublicRateLimit(clientIP, uploadConfig.rateLimit || 10)
    if (!rateLimitResult.allowed) {
      throw createError({ statusCode: 429, message: `请求过于频繁，请 ${rateLimitResult.retryAfter} 秒后重试` })
    }

    if (!uploadConfig.allowConcurrent) {
      const concurrencyResult = checkPublicConcurrency(clientIP)
      if (!concurrencyResult.allowed) {
        throw createError({ statusCode: 429, message: '请等待上一项媒体上传完成' })
      }
      acquirePublicConcurrency(clientIP)
    }

    const { file } = await parseFormData(event)
    if (!file) {
      releasePublicConcurrency(clientIP)
      throw createError({ statusCode: 400, message: '请选择要上传的媒体文件' })
    }

    validateMediaByConfig({
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

    releasePublicConcurrency(clientIP)

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
    releasePublicConcurrency(clientIP)

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
