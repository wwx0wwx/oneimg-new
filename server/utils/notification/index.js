/**
 * 通知服务编排层：按配置分发到渠道注册表，组装各业务通知（登录/上传/审核）。
 * 对外导出面与历史 notification.js 完全一致。
 */
import { NOTIFICATION_TYPES, NOTIFICATION_METHODS, getNotificationConfig, getNotificationConfigMasked, saveNotificationConfig, getDefaultNotificationConfig } from './config.js'
import { CHANNELS } from './channels/index.js'

export { NOTIFICATION_TYPES, NOTIFICATION_METHODS, getDefaultNotificationConfig, getNotificationConfig, getNotificationConfigMasked, saveNotificationConfig }
export { testWebhook, testTelegram, testEmail, testServerChan } from './compat-names.js'

/**
 * 发送通知
 * @param {string} type - 通知类型
 * @param {object} payload - 通知内容
 */
export async function sendNotification(type, payload) {
  try {
    const config = await getNotificationConfig()

    if (!config.enabled) {
      return { success: true, skipped: true, reason: '通知功能未启用' }
    }

    if (!config.types[type]) {
      return { success: true, skipped: true, reason: `${type} 类型通知未启用` }
    }

    const channel = CHANNELS[config.method]
    if (!channel) {
      return { success: false, error: `不支持的通知方式: ${config.method}` }
    }

    return await channel.send(config, {
      type,
      ...payload,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Notification] 发送通知失败:', error)
    return { success: false, error: error.message }
  }
}

/** 发送登录通知 */
export async function sendLoginNotification(username, ip, userAgent) {
  return sendNotification(NOTIFICATION_TYPES.LOGIN, {
    title: '登录通知',
    message: `用户 ${username} 已登录`,
    data: {
      username,
      ip,
      userAgent,
      loginTime: new Date().toISOString()
    }
  })
}

/** 发送上传通知 */
export async function sendUploadNotification(imageInfo, uploaderInfo) {
  return sendNotification(NOTIFICATION_TYPES.UPLOAD, {
    title: '媒体上传通知',
    message: `新媒体已上传: ${imageInfo.filename}`,
    data: {
      imageId: imageInfo.id,
      filename: imageInfo.filename,
      format: imageInfo.format,
      size: imageInfo.size,
      url: imageInfo.url,
      uploader: uploaderInfo.name,
      uploaderType: uploaderInfo.type,
      ip: uploaderInfo.ip,
      uploadTime: new Date().toISOString()
    }
  })
}

/** 发送鉴黄检测结果通知 */
export async function sendNsfwNotification(imageInfo, moderationResult) {
  const isNsfw = moderationResult.isNsfw
  return sendNotification(NOTIFICATION_TYPES.NSFW_DETECTED, {
    title: isNsfw ? '⚠️ 检测到违规图片' : '图片审核通过',
    message: isNsfw
      ? `图片 ${imageInfo.filename} 被检测为违规内容`
      : `图片 ${imageInfo.filename} 审核通过`,
    data: {
      imageId: imageInfo.id,
      filename: imageInfo.filename,
      url: imageInfo.url,
      isNsfw,
      score: moderationResult.score,
      provider: moderationResult.provider,
      checkTime: new Date().toISOString()
    }
  })
}

export default {
  NOTIFICATION_TYPES,
  NOTIFICATION_METHODS,
  getDefaultNotificationConfig,
  getNotificationConfig,
  getNotificationConfigMasked,
  saveNotificationConfig,
  sendNotification,
  sendLoginNotification,
  sendUploadNotification,
  sendNsfwNotification
}
