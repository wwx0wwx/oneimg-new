/**
 * Webhook 渠道：发送与连通性测试。
 * 出站统一走 pinnedFetch（地址校验 + 固定 IP 连接 + 超时 + 体积上限）。
 */
import { pinnedFetch } from '../../netGuard.js'
import { replaceTemplateVariables } from '../template.js'

const DEFAULT_TEST_BODY_TEMPLATE = JSON.stringify({
  type: '{{type}}',
  title: '{{title}}',
  message: '{{message}}',
  timestamp: '{{timestamp}}',
  data: '{{data}}'
}, null, 2)

async function postWebhook(webhookConfig, body) {
  const headers = {
    'Content-Type': webhookConfig.contentType || 'application/json',
    ...webhookConfig.headers
  }
  const response = await pinnedFetch(webhookConfig.url, {
    method: webhookConfig.method || 'POST',
    headers,
    body,
    timeoutMs: 15000
  })
  if (response.status < 200 || response.status >= 300) {
    const errorText = response.body.toString('utf8')
    const err = new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`)
    err.detail = errorText
    throw err
  }
  return response
}

export async function send(config, payload) {
  const { webhook } = config

  if (!webhook.url) {
    console.warn('[Notification] Webhook URL 未配置')
    return { success: false, error: 'Webhook URL 未配置' }
  }

  try {
    const variables = {
      type: payload.type,
      title: payload.title,
      message: payload.message,
      timestamp: payload.timestamp || new Date().toISOString(),
      data: payload.data || {}
    }
    const body = replaceTemplateVariables(webhook.bodyTemplate, variables)
    await postWebhook(webhook, body)
    console.log('[Notification] Webhook 通知发送成功:', payload.type)
    return { success: true }
  } catch (error) {
    console.error('[Notification] Webhook 发送失败:', error.detail ? `${error.message}` : error)
    return { success: false, error: error.message.includes('HTTP') ? `Webhook ${error.message}` : `Webhook 请求失败: ${error.message}` }
  }
}

export async function test(webhookConfig) {
  try {
    const testPayload = {
      type: 'test',
      title: '测试通知',
      message: '这是一条测试通知，用于验证 Webhook 配置是否正确。',
      timestamp: new Date().toISOString(),
      data: { test: true }
    }
    const body = replaceTemplateVariables(webhookConfig.bodyTemplate || DEFAULT_TEST_BODY_TEMPLATE, testPayload)
    await postWebhook(webhookConfig, body)
    return { success: true, message: '测试通知发送成功' }
  } catch (error) {
    return { success: false, error: `Webhook 请求失败: ${error.message}` }
  }
}
