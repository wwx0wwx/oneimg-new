/**
 * Email 渠道：发送（含图片链接与详情表格）与连通性测试。
 * 动态字段一律 HTML 转义（防注入，L6）。
 */
import nodemailer from 'nodemailer'
import { escapeHtmlText, generateEmailTemplate, isValidImageUrl } from '../template.js'

function buildEmailHtml(payload) {
  const imageUrl = payload.data?.url || payload.data?.imageUrl
  const hasValidImageUrl = isValidImageUrl(imageUrl)

  let htmlContent = `
      <div class="header">
        <h1>${escapeHtmlText(payload.title)}</h1>
      </div>
      <div class="content">
        <p>${escapeHtmlText(payload.message)}</p>
    `

  if (hasValidImageUrl) {
    htmlContent += `
        <div style="margin-top: 20px; text-align: center;">
          <img src="${escapeHtmlText(imageUrl)}" alt="上传的图片" style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          <p style="margin-top: 10px; font-size: 12px; color: #666;">
            <a href="${escapeHtmlText(imageUrl)}" target="_blank" style="color: #007bff;">点击查看原图</a>
          </p>
        </div>
      `
  }

  if (payload.data && Object.keys(payload.data).length > 0) {
    htmlContent += '<div style="margin-top: 20px;"><h3>详细信息</h3>'
    for (const [key, value] of Object.entries(payload.data)) {
      if (key === 'url' || key === 'imageUrl') continue
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value
      htmlContent += `
          <div class="info-item">
            <span class="info-label">${escapeHtmlText(key)}:</span>
            <span class="info-value">${escapeHtmlText(displayValue)}</span>
          </div>
        `
    }
    htmlContent += '</div>'
  }

  htmlContent += '</div>'
  return htmlContent
}

function createTransporter(email) {
  return nodemailer.createTransport({
    service: email.service,
    auth: {
      user: email.user,
      pass: email.pass
    }
  })
}

export async function send(config, payload) {
  const { email } = config

  if (!email.service || !email.user || !email.pass) {
    console.warn('[Notification] Email 配置不完整')
    return { success: false, error: 'Email 配置不完整（需要 service、user、pass）' }
  }

  try {
    console.log('[Notification] 邮件通知预发送:', payload.title)
    const transporter = createTransporter(email)

    await transporter.sendMail({
      from: email.user,
      to: email.to || email.user,
      subject: `[OneImg] ${payload.title}`,
      html: generateEmailTemplate(buildEmailHtml(payload))
    })

    console.log('[Notification] 邮件通知发送成功:', payload.title)
    return { success: true }
  } catch (error) {
    console.error('[Notification] 邮件发送失败:', error)
    return { success: false, error: error.message }
  }
}

export async function test(emailConfig) {
  try {
    if (!emailConfig.service || !emailConfig.user || !emailConfig.pass) {
      return { success: false, error: '请提供完整的邮件配置（service、user、pass）' }
    }

    const transporter = createTransporter(emailConfig)
    const htmlContent = `
      <div class="header">
        <h1>测试通知</h1>
      </div>
      <div class="content">
        <p>这是一条测试通知，用于验证邮件配置是否正确。</p>
        <div class="info-item">
          <span class="info-label">发送时间:</span>
          <span class="info-value">${new Date().toISOString()}</span>
        </div>
      </div>
    `

    await transporter.sendMail({
      from: emailConfig.user,
      to: emailConfig.to || emailConfig.user,
      subject: '[OneImg] 测试通知',
      html: generateEmailTemplate(htmlContent)
    })

    return { success: true, message: '测试通知发送成功' }
  } catch (error) {
    console.error('[Notification] Email 测试失败:', error)
    return { success: false, error: error.message }
  }
}
