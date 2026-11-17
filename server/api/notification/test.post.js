import { requireAdmin } from '../../utils/auth.js'
import { testWebhook, testTelegram, testEmail, testServerChan } from '../../utils/notification/index.js'
import { isMaskedSecret } from '../../utils/secretBox.js'
import { getNotificationConfig } from '../../utils/notification/index.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)
    const { webhook, telegram, email, serverchan, method } = body

    // 掩码密钥替换为库中真实值（GET 返回掩码，管理员刷新后再点测试时回传的是 ****）
    const current = await getNotificationConfig()
    const unmask = (incoming, existing) => (isMaskedSecret(incoming) ? existing : incoming)

    if (method === 'serverchan') {
      if (!serverchan?.sendKey) {
        throw createError({ statusCode: 400, message: '请提供 Server酱 SendKey' })
      }
      const result = await testServerChan({ sendKey: unmask(serverchan?.sendKey, current.serverchan.sendKey) })
      return { success: !!result.success, message: result.success ? '测试通知发送成功' : (result.error || '测试失败') }
    }

    if (method === 'email') {
      if (!email?.service || !email?.user || !email?.pass) {
        throw createError({ statusCode: 400, message: '请提供完整的邮件配置（service、user、pass）' })
      }
      const result = await testEmail({
        service: email.service,
        user: email.user,
        pass: unmask(email.pass, current.email.pass),
        to: email.to || ''
      })
      return { success: !!result.success, message: result.success ? '测试通知发送成功' : (result.error || '测试失败') }
    }

    if (method === 'telegram') {
      if (!telegram?.token || !telegram?.chatId) {
        throw createError({ statusCode: 400, message: '请提供 Telegram Token 和 Chat ID' })
      }
      const result = await testTelegram({ token: unmask(telegram.token, current.telegram.token), chatId: telegram.chatId })
      return { success: !!result.success, message: result.success ? '测试通知发送成功' : (result.error || '测试失败') }
    }

    if (!webhook?.url) {
      throw createError({ statusCode: 400, message: '请提供 Webhook URL' })
    }

    const result = await testWebhook({
      url: webhook.url,
      method: webhook.method || 'POST',
      contentType: webhook.contentType || 'application/json',
      headers: webhook.headers || {},
      bodyTemplate: webhook.bodyTemplate || JSON.stringify({
        type: '{{type}}',
        title: '{{title}}',
        message: '{{message}}',
        timestamp: '{{timestamp}}',
        data: '{{data}}'
      }, null, 2)
    })

    return { success: !!result.success, message: result.success ? '测试通知发送成功' : (result.error || '测试失败') }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Notification] 测试通知失败:', error)
    throw createError({
      statusCode: 500,
      message: '测试失败，请稍后重试'
    })
  }
})
