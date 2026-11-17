import { getAuthUser, isAdminUser } from '../../utils/auth.js'
import { getUploadPolicy } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  const policy = await getUploadPolicy()

  // 视图保持历史 mediaConfig 形状（前端兼容）；实际读写已指向 uploadPolicy 策略域
  const policyView = {
    allowAnonymousUpload: policy.allowAnonymousUpload,
    allowedExtensions: policy.allowedExtensions,
    anonymousMaxFileSize: policy.sizeLimits.anonymous,
    userMaxFileSize: policy.sizeLimits.user,
    adminMaxFileSize: policy.sizeLimits.admin,
    defaultUserVisibility: policy.defaultUserVisibility
  }

  if (!user || !isAdminUser(user)) {
    return { success: true, data: policyView }
  }
  return { success: true, data: policyView }
})
