import db from '../../utils/db.js'
import { requireAuthUser, getMediaOwnerFromUser, isAdminUser, USER_ROLES } from '../../utils/auth.js'
import { importMediaFromUrl } from '../../utils/urlImport.js'
import { getMediaConfig } from '../../utils/mediaConfig.js'

export default defineEventHandler(async (event) => {
  try {
    const apiKey = getHeader(event, 'x-api-key') || getQuery(event).apiKey
    let owner = null
    let uploadedByType = 'url'
    let apiKeyId = null

    if (apiKey) {
      const keyDoc = await db.apikeys.findOne({ key: apiKey, enabled: true })
      if (!keyDoc) {
        throw createError({ statusCode: 401, message: 'API Key 无效或已禁用' })
      }
      if (!keyDoc.ownerUserId) {
        throw createError({ statusCode: 400, message: '该 API Key 尚未绑定用户，无法导入私有媒体' })
      }

      const ownerUser = await db.users.findOne({ _id: keyDoc.ownerUserId, status: { $ne: 'disabled' } })
      if (!ownerUser) {
        throw createError({ statusCode: 403, message: 'API Key 绑定的用户不存在或已被禁用' })
      }

      owner = getMediaOwnerFromUser(ownerUser)
      uploadedByType = 'url-api-key'
      apiKeyId = keyDoc._id
    } else {
      const user = await requireAuthUser(event)
      owner = getMediaOwnerFromUser(user)
    }

    const body = await readBody(event)
    const { url, returnBase64 = false } = body

    if (!url) {
      throw createError({ statusCode: 400, message: '请提供媒体 URL' })
    }

    const isArrayUrl = Array.isArray(url)
    const urls = isArrayUrl ? url : [url]
    if (urls.length === 0) {
      throw createError({ statusCode: 400, message: '请提供至少一个媒体 URL' })
    }

    const configDoc = await db.settings.findOne({ key: 'privateApiConfig' })
    const uploadConfig = configDoc?.value || {}
    const mediaConfig = await getMediaConfig()

    const results = []
    const errors = []

    for (let i = 0; i < urls.length; i++) {
      const currentUrl = urls[i]
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      try {
        const responseData = await importMediaFromUrl({
          event,
          url: currentUrl,
          owner,
          ownerRole: owner?.role || USER_ROLES.USER,
          uploadedByType,
          visibility: isAdminUser({ role: owner?.role }) ? 'public' : (mediaConfig.defaultUserVisibility || 'private'),
          uploadConfig,
          returnBase64,
          apiKeyId
        })

        results.push({ success: true, data: responseData })
      } catch (error) {
        errors.push({
          success: false,
          error: error.statusCode ? error.message : '导入失败，请稍后重试'
        })
      }
    }

    if (isArrayUrl) {
      return {
        success: true,
        message: `处理完成：${results.length} 个成功，${errors.length} 个失败`,
        data: {
          results,
          errors,
          total: urls.length,
          successCount: results.length,
          errorCount: errors.length
        }
      }
    }

    if (results.length > 0) {
      return {
        success: true,
        message: '导入成功',
        data: results[0].data
      }
    }

    throw createError({ statusCode: 400, message: errors[0]?.error || '导入失败' })
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Upload] URL 导入失败:', error)
    throw createError({
      statusCode: 500,
      message: '导入失败，请稍后重试'
    })
  }
})
