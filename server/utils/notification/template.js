/**
 * 通知模板与展示工具：变量替换、邮件 HTML 骨架、HTML/Markdown 转义、URL 校验。
 * 各渠道（webhook/telegram/email/serverchan）共享。
 */

/** 替换模板变量（{{key}} 占位符，对象值序列化为 JSON） */
export function replaceTemplateVariables(template, variables) {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value)
    result = result.split(placeholder).join(replacement)
  }
  return result
}

/**
 * HTML 转义：邮件模板中的动态字段（标题/消息/文件名等）一律转义，
 * 防止媒体原始名等外部可控内容注入邮件 HTML
 */
export function escapeHtmlText(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 邮件 HTML 骨架（统一页脚与样式） */
export function generateEmailTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      border-bottom: 2px solid #007bff;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      color: #007bff;
      font-size: 24px;
    }
    .content {
      padding: 10px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .info-item {
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-item:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .info-value {
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>此邮件由 OneImg 个人媒体床系统自动发送</p>
    </div>
  </div>
</body>
</html>
  `
}

/** 检查URL是否为有效的完整URL（包含协议和主机） */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 转义 Telegram Markdown 特殊字符（_ * ` [ ） */
export function escapeMarkdown(text) {
  if (!text) return ''
  return String(text).replace(/([_*`\[])/g, '\\$1')
}
