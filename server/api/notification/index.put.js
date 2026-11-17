import { requireAdmin } from '../../utils/auth.js'
import { saveNotificationConfig, getNotificationConfig, NOTIFICATION_TYPES, NOTIFICATION_METHODS } from '../../utils/notification.js'
import { isMaskedSecret, maskSecret } from '../../utils/secretBox.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)
    const { enabled, method, types, webhook } = body
    const { telegram, email, serverchan } = body

    if (method && !Object.values(NOTIFICATION_METHODS).includes(method)) {
      throw createError({
        statusCode: 400,
        message: `不支持的通知方式: ${method}`
      })
    }

    // 客户端提交的可能是脱敏占位（****）或留空：这些情况保留库中已有密钥，避免掩码覆盖真实值
    const current = await getNotificationConfig()
    const keepOr = (incoming, existing) => (isMaskedSecret(incoming) ? existing : incoming)

    const config = {
      enabled: !!enabled,
      method: method || NOTIFICATION_METHODS.WEBHOOK,
      types: {
        [NOTIFICATION_TYPES.LOGIN]: !!types?.login,
        [NOTIFICATION_TYPES.UPLOAD]: !!types?.upload,
        [NOTIFICATION_TYPES.NSFW_DETECTED]: !!types?.nsfw
      },
      webhook: {
        url: webhook?.url || '',
        method: webhook?.method || 'POST',
        contentType: webhook?.contentType || 'application/json',
        headers: webhook?.headers || {},
        bodyTemplate: webhook?.bodyTemplate || JSON.stringify({
          type: '{{type}}',
          title: '{{title}}',
          message: '{{message}}',
          timestamp: '{{timestamp}}',
          data: '{{data}}'
        }, null, 2)
      },
      telegram: {
        token: keepOr(telegram?.token, current.telegram.token),
        chatId: telegram?.chatId || current.telegram.chatId || ''
      },
      email: {
        service: email?.service || current.email.service || '',
        user: email?.user || current.email.user || '',
        pass: keepOr(email?.pass, current.email.pass),
        to: email?.to || current.email.to || ''
      },
      serverchan: {
        sendKey: keepOr(serverchan?.sendKey, current.serverchan.sendKey)
      }
    }

    const result = await saveNotificationConfig(config)
    if (!result.success) {
      throw createError({
        statusCode: 500,
        message: result.error || '保存配置失败'
      })
    }

    // 响应与 GET 一律脱敏回显（config 中的密钥为明文/解密值，不可直接返回）
    const maskedConfig = {
      ...config,
      telegram: { ...config.telegram, token: maskSecret(config.telegram.token) },
      email: { ...config.email, pass: maskSecret(config.email.pass) },
      serverchan: { ...config.serverchan, sendKey: maskSecret(config.serverchan.sendKey) }
    }
    return {
      success: true,
      message: '通知配置已保存',
      data: maskedConfig
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Notification] 保存通知配置失败:', error)
    throw createError({
      statusCode: 500,
      message: '保存通知配置失败'
    })
  }
})
