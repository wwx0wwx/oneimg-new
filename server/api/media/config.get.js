import { getMediaConfig } from '../../utils/mediaConfig.js'
import { getAuthUser, isAdminUser } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  const config = await getMediaConfig()

  if (!user || !isAdminUser(user)) {
    return {
      success: true,
      data: {
        allowAnonymousUpload: config.allowAnonymousUpload,
        allowedExtensions: config.allowedExtensions,
        anonymousMaxFileSize: config.anonymousMaxFileSize,
        userMaxFileSize: config.userMaxFileSize,
        adminMaxFileSize: config.adminMaxFileSize,
        defaultUserVisibility: config.defaultUserVisibility
      }
    }
  }

  return { success: true, data: config }
})
