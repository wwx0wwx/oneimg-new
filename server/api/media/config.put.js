import { requireAdmin } from '../../utils/auth.js'
import { getUploadPolicy, saveUploadPolicy } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const policy = await getUploadPolicy()

  // 入参保持历史 mediaConfig 形状，写入 uploadPolicy 策略域
  const next = {
    ...policy,
    allowAnonymousUpload: body.allowAnonymousUpload === true,
    allowedExtensions: Array.isArray(body.allowedExtensions) && body.allowedExtensions.length > 0
      ? body.allowedExtensions
      : policy.allowedExtensions,
    sizeLimits: {
      anonymous: Number(body.anonymousMaxFileSize) > 0 ? Math.round(Number(body.anonymousMaxFileSize)) : policy.sizeLimits.anonymous,
      user: Number(body.userMaxFileSize) > 0 ? Math.round(Number(body.userMaxFileSize)) : policy.sizeLimits.user,
      admin: Number(body.adminMaxFileSize) > 0 ? Math.round(Number(body.adminMaxFileSize)) : policy.sizeLimits.admin
    },
    defaultUserVisibility: body.defaultUserVisibility === 'public' ? 'public' : (body.defaultUserVisibility === 'private' ? 'private' : policy.defaultUserVisibility)
  }

  const saved = await saveUploadPolicy(next)

  return {
    success: true,
    message: '媒体配置已保存',
    data: {
      allowAnonymousUpload: saved.allowAnonymousUpload,
      allowedExtensions: saved.allowedExtensions,
      anonymousMaxFileSize: saved.sizeLimits.anonymous,
      userMaxFileSize: saved.sizeLimits.user,
      adminMaxFileSize: saved.sizeLimits.admin,
      defaultUserVisibility: saved.defaultUserVisibility
    }
  }
})
