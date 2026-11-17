/**
 * Server酱渠道：发送与连通性测试（固定域名 sctapi.ftqq.com，15s 超时）。
 */
import { isValidImageUrl } from '../template.js'

const SERVERCHAN_API = 'https://sctapi.ftqq.com'

async function postServerChan(sendKey, params) {
  // sendKey 进入 URL 路径，严格白名单校验（防注入）
  if (!/^[A-Za-z0-9_]+$/.test(String(sendKey))) {
    throw new Error('无效的 SendKey 格式')
  }
  const response = await fetch(`${SERVERCHAN_API}/${sendKey}.send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params,
    signal: AbortSignal.timeout(15000)
  })
  const data = await response.json()
  if (data.code !== 0) {
    const err = new Error(data.message || 'Server酱发送失败')
    err.raw = data
    throw err
  }
  return data
}

export async function send(config, payload) {
  const { serverchan } = config

  if (!serverchan.sendKey) {
    console.warn('[Notification] Server酱 SendKey 未配置')
    return { success: false, error: 'Server酱 SendKey 未配置' }
  }

  try {
    console.log('[Notification] Server酱通知预发送:', payload.title)

    const imageUrl = payload.data?.url || payload.data?.imageUrl
    const hasValidImageUrl = isValidImageUrl(imageUrl)

    // 构建消息内容（Markdown 格式）
    let content = payload.message
    if (hasValidImageUrl) {
      content += `\n\n![图片预览](${imageUrl})`
    }

    if (payload.data && Object.keys(payload.data).length > 0) {
      content += '\n\n### 详细信息\n'
      for (const [key, value] of Object.entries(payload.data)) {
        if (key === 'url' || key === 'imageUrl') continue
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : value
        content += `\n- **${key}**: ${displayValue}`
      }
    }

    // 先转义再拼接（转义加粗标记外的部分；括号也需转义防链接注入）
    const escapeMd = (v = '') => String(v).replace(/([_*`\[\]()])/g, '\\$1')
    await postServerChan(serverchan.sendKey, new URLSearchParams({
      text: escapeMd(payload.title),
      desp: content
        .split(/(\*\*[^*]+\*\*)/)  // 保留 **bold** 标记
        .map(part => part.startsWith('**') ? part : escapeMd(part))
        .join('')
    }))

    console.log('[Notification] Server酱通知发送成功:', payload.title)
    return { success: true }
  } catch (error) {
    console.error('[Notification] Server酱发送失败:', error.raw || error)
    return { success: false, error: error.message }
  }
}

export async function test(serverchanConfig) {
  try {
    if (!serverchanConfig.sendKey) {
      return { success: false, error: '请提供 Server酱 SendKey' }
    }

    const content = `这是一条测试通知，用于验证 Server酱 配置是否正确。\n\n发送时间: ${new Date().toISOString()}`
    await postServerChan(serverchanConfig.sendKey, new URLSearchParams({
      text: '测试通知',
      desp: content
    }))
    return { success: true, message: '测试通知发送成功' }
  } catch (error) {
    console.error('[Notification] Server酱测试失败:', error.raw || error)
    return { success: false, error: error.message }
  }
}
