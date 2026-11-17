import db from '../../utils/db.js'
import { requireAuthUser, getMediaOwnerFromUser, resolveUploadRole } from '../../utils/auth.js'
import { importMediaFromUrl, MAX_URL_IMPORT_BATCH } from '../../utils/urlImport.js'
import { getMediaConfig } from '../../utils/mediaConfig.js'
import { checkRateLimit } from '../../utils/rateLimit.js'
import { isBlacklisted } from '../../utils/ipBlacklist.js'

async function downloadAndSaveMedia({ event, url, uploadConfig, owner, ownerRole, mediaConfig, enableModeration }) {
  return await importMediaFromUrl({
    event,
    url,
    owner,
    ownerRole,
    uploadedByType: 'url',
    visibility: mediaConfig.defaultUserVisibility || 'private',
    uploadConfig,
    enableModeration
  })
}

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event)
    const owner = getMediaOwnerFromUser(user)
    const ownerRole = resolveUploadRole(user)

    // 批量导入限速（SSE 单请求最多 20 个 URL，且每 IP 每分钟最多 10 次导入）
    const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    const rl = await checkRateLimit('urlimport', `urlimport:${clientIP}`, { limit: 10 })
    if (!rl.allowed) {
      throw createError({ statusCode: 429, message: `导入请求过于频繁，请 ${rl.retryAfter ?? 60} 秒后重试` })
    }

    if (await isBlacklisted(clientIP)) {
      throw createError({ statusCode: 403, message: '您的 IP 已被禁止上传' })
    }

    const body = await readBody(event)
    const { urls } = body

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw createError({ statusCode: 400, message: '请提供媒体 URL 列表' })
    }

    const validUrls = [...new Set(urls.map(u => u.trim()).filter(u => u.length > 0))]
    if (validUrls.length === 0) {
      throw createError({ statusCode: 400, message: '请提供有效的媒体 URL' })
    }
    // 服务端强制批量上限，前端限制可被绕过
    if (validUrls.length > MAX_URL_IMPORT_BATCH) {
      throw createError({ statusCode: 400, message: `单次最多导入 ${MAX_URL_IMPORT_BATCH} 个 URL` })
    }

    const configDoc = await db.settings.findOne({ key: 'privateApiConfig' })
    const uploadConfig = configDoc?.value || {}
    const mediaConfig = await getMediaConfig()
    const moderationConfigDoc = await db.settings.findOne({ key: 'publicApiConfig' })
    const moderationEnabled = moderationConfigDoc?.value?.contentSafety?.enabled === true

    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    setHeader(event, 'X-Accel-Buffering', 'no')

    const responseStream = event.node.res
    const sendEvent = (eventType, data) => {
      const eventData = JSON.stringify(data)
      responseStream.write(`event: ${eventType}\n`)
      responseStream.write(`data: ${eventData}\n\n`)
    }

    sendEvent('start', {
      total: validUrls.length,
      message: '开始导入媒体'
    })

    const results = []
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i]
      const index = i + 1

      sendEvent('progress', {
        index,
        total: validUrls.length,
        url,
        status: 'downloading',
        message: `正在导入第 ${index}/${validUrls.length} 个媒体项`
      })

      try {
        const result = await downloadAndSaveMedia({
          event,
          url,
          uploadConfig,
          owner,
          ownerRole,
          mediaConfig,
          enableModeration: moderationEnabled
        })
        successCount++
        results.push({ url, success: true, data: result })

        sendEvent('progress', {
          index,
          total: validUrls.length,
          url,
          status: 'success',
          message: `第 ${index}/${validUrls.length} 个媒体项导入成功`,
          data: result
        })
      } catch (error) {
        failCount++
        const errorMessage = error.message || '导入失败'
        results.push({ url, success: false, error: errorMessage })

        sendEvent('progress', {
          index,
          total: validUrls.length,
          url,
          status: 'error',
          message: `第 ${index}/${validUrls.length} 个媒体项导入失败: ${errorMessage}`,
          error: errorMessage
        })
      }

      if (i < validUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    sendEvent('complete', {
      total: validUrls.length,
      successCount,
      failCount,
      message: `导入完成：成功 ${successCount} 个，失败 ${failCount} 个`,
      results
    })

    responseStream.end()
  } catch (error) {
    if (!event.node.res.headersSent) {
      if (error.statusCode) {
        throw error
      }

      console.error('[Upload] 批量 URL 导入失败:', error)
      throw createError({
        statusCode: 500,
        message: '导入失败，请稍后重试'
      })
    }

    const responseStream = event.node.res
    const errorData = JSON.stringify({
      error: error.message || '导入失败',
      message: '导入过程中发生错误'
    })
    responseStream.write(`event: error\n`)
    responseStream.write(`data: ${errorData}\n\n`)
    responseStream.end()
  }
})
