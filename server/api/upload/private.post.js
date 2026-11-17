import db from '../../utils/db.js'
import { parseFormData } from '../../utils/media.js'
import { sendUploadNotification } from '../../utils/notification.js'
import { getMediaConfig } from '../../utils/mediaConfig.js'
import { getUploadPolicy, processingToFlat } from '../../utils/uploadPolicy.js'
import { validateMediaByConfig, createMediaRecord } from '../../utils/mediaService.js'
import { USER_ROLES, requireAuthUser, resolveUploadRole } from '../../utils/auth.js'
import { checkPrivateRateLimit } from '../../utils/rateLimit.js'
import { isBlacklisted } from '../../utils/ipBlacklist.js'

// 与管理员最大上传限制对齐（角色限额由 validateMediaByConfig 统一校验），
// 此处仅做硬上限兜底，避免 base64 载荷无界膨胀
const MAX_BASE64_SIZE = 100 * 1024 * 1024

function parseBase64Media(base64String) {
  let base64Data = base64String
  let format = 'png'
  let mimeType = 'image/png'

  const dataUriMatch = base64String.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/)
  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase()
    base64Data = dataUriMatch[2]

    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov'
    }
    format = mimeToExt[mimeType] || 'png'
  }

  // 先按 base64 字符长度估算解码后大小（约 3/4），超限直接拒绝，
  // 避免"先解码最多 ~133MB 进内存、再检查"的内存尖峰
  if (base64Data.length > Math.ceil(MAX_BASE64_SIZE / 0.75)) {
    throw new Error(`base64 媒体大小超过限制（最大 ${Math.round(MAX_BASE64_SIZE / 1024 / 1024)}MB）`)
  }

  const buffer = Buffer.from(base64Data, 'base64')
  if (buffer.length === 0) {
    throw new Error('无效的 base64 数据')
  }
  if (buffer.length > MAX_BASE64_SIZE) {
    throw new Error(`base64 媒体大小超过限制（最大 ${Math.round(MAX_BASE64_SIZE / 1024 / 1024)}MB）`)
  }

  return {
    buffer,
    format,
    mimeType,
    originalFilename: `media.${format}`
  }
}

async function resolveUploadOwner(event) {
  const authUser = await getOptionalAuthUser(event)
  if (authUser) {
    return {
      ownerUser: authUser,
      role: resolveUploadRole(authUser),
      uploadedByType: 'user',
      apiKeyId: null
    }
  }

  // API Key 仅接受请求头传递：query 传参会被反代日志/浏览器历史留存
  const apiKey = getHeader(event, 'x-api-key')
  if (!apiKey) {
    throw createError({ statusCode: 401, message: '未登录且缺少 API Key（请通过 X-API-Key 请求头传递）' })
  }

  const keyDoc = await db.apikeys.findOne({ key: apiKey, enabled: true })
  if (!keyDoc) {
    throw createError({ statusCode: 401, message: 'API Key 无效或已禁用' })
  }

  if (!keyDoc.ownerUserId) {
    throw createError({ statusCode: 400, message: '该 API Key 尚未绑定用户，无法上传私有媒体' })
  }

  const ownerUser = await db.users.findOne({ _id: keyDoc.ownerUserId, status: { $ne: 'disabled' } })
  if (!ownerUser) {
    throw createError({ statusCode: 403, message: 'API Key 绑定的用户不存在或已被禁用' })
  }

  return {
    ownerUser,
    role: ownerUser.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.USER,
    uploadedByType: 'api-key',
    apiKeyId: keyDoc._id
  }
}

async function getOptionalAuthUser(event) {
  try {
    return await requireAuthUser(event)
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

  try {
    const { ownerUser, role, uploadedByType, apiKeyId } = await resolveUploadOwner(event)

    // IP 黑名单同样约束登录上传与 API Key 上传（此前只挡匿名上传）
    if (await isBlacklisted(clientIP)) {
      throw createError({ statusCode: 403, message: '您的 IP 已被禁止上传' })
    }
    // 统一读取 uploadPolicy（新单一事实源；旧部署未迁移时由其内部合并旧键）
    const policy = await getUploadPolicy()
    const mediaConfig = policy
    const uploadConfig = processingToFlat(policy.processing)

    const rateLimitResult = await checkPrivateRateLimit(clientIP, policy.limits.authenticatedPerMin)
    if (!rateLimitResult.allowed) {
      throw createError({ statusCode: 429, message: `请求过于频繁，请 ${rateLimitResult.retryAfter} 秒后重试` })
    }

    // 内容审核配置与队列同源（uploadPolicy.contentSafety）
    const moderationEnabled = policy.contentSafety?.enabled === true

    let file = null
    const contentType = getHeader(event, 'content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await readBody(event)
      if (body.base64) {
        try {
          const parsed = parseBase64Media(body.base64)
          file = {
            buffer: parsed.buffer,
            originalFilename: body.filename || parsed.originalFilename,
            mimetype: parsed.mimeType,
            size: parsed.buffer.length
          }
        } catch (e) {
          throw createError({
            statusCode: 400,
            message: `base64 媒体数据无效: ${e.message}`
          })
        }
      }
    } else {
      const formResult = await parseFormData(event)
      file = formResult.file
    }

    if (!file) {
      throw createError({
        statusCode: 400,
        message: '请选择要上传的媒体，支持 multipart/form-data 或 JSON 格式的 base64 字符串'
      })
    }

    await validateMediaByConfig({
      file,
      role,
      config: mediaConfig,
      allowAnonymousUpload: false
    })

    const { record, response } = await createMediaRecord({
      event,
      file,
      owner: { id: ownerUser._id, name: ownerUser.username, role },
      uploadedByType,
      visibility: mediaConfig.defaultUserVisibility || 'private',
      uploadConfig,
      enableModeration: moderationEnabled,
      apiKeyId
    })

    sendUploadNotification(
      {
        id: record._id,
        filename: record.filename,
        format: record.format,
        size: record.size,
        url: response.fullUrl
      },
      {
        name: ownerUser.username,
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
    if (error.statusCode) {
      throw error
    }

    console.error('[Upload] 私有上传失败:', error)
    throw createError({
      statusCode: 500,
      message: '上传失败，请稍后重试'
    })
  }
})

