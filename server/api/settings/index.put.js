import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'
import sanitizeHtml from 'sanitize-html'

// 公告 HTML 净化：基于 sanitize-html 白名单。
// 旧实现为手写正则，未加引号的属性（如 href=javascript:alert(1)）可绕过协议检查，
// 已实测可存活 javascript: URL，构成存储型 XSS 向量，故整体替换。
function sanitizeAnnouncementHtml(html = '') {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'span', 'br'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
      p: ['style']
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowedStyles: {
      '*': {
        color: [/.*/],
        'background-color': [/.*/],
        'font-size': [/.*/],
        'font-weight': [/.*/],
        'text-align': [/.*/]
      }
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' })
    }
  })
}

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const currentSettings = await db.settings.findOne({ key: 'appSettings' })
    const currentValue = currentSettings?.value || {
      appName: 'OneImg',
      appLogo: '',
      backgroundUrl: '',
      backgroundBlur: 0,
      siteUrl: '',
      appDescription: 'OneImg 是一个面向个人使用的媒体床，统一管理图片与视频。',
      announcement: {
        enabled: false,
        content: '',
        displayType: 'modal'
      }
    }

    const body = await readBody(event)
    const updatedValue = { ...currentValue }

    if (body.appName !== undefined) {
      updatedValue.appName = String(body.appName || 'OneImg').trim() || 'OneImg'
    }

    if (body.appLogo !== undefined) {
      updatedValue.appLogo = String(body.appLogo || '').trim()
    }

    if (body.backgroundUrl !== undefined) {
      updatedValue.backgroundUrl = String(body.backgroundUrl || '').trim()
    }

    if (body.backgroundBlur !== undefined) {
      let blurValue = parseInt(body.backgroundBlur) || 0
      if (blurValue < 0) blurValue = 0
      if (blurValue > 20) blurValue = 20
      updatedValue.backgroundBlur = blurValue
    }

    if (body.siteUrl !== undefined) {
      let siteUrlValue = String(body.siteUrl || '').trim()
      if (siteUrlValue) {
        siteUrlValue = siteUrlValue.replace(/\/+$/, '')
      }
      updatedValue.siteUrl = siteUrlValue
    }

    if (body.appDescription !== undefined) {
      updatedValue.appDescription = String(body.appDescription || '').trim() || 'OneImg 是一个面向个人使用的媒体床，统一管理图片与视频。'
    }

    if (body.announcement !== undefined) {
      if (body.announcement === null) {
        updatedValue.announcement = {
          enabled: false,
          content: '',
          displayType: 'modal'
        }
      } else {
        updatedValue.announcement = {
          enabled: body.announcement.enabled !== undefined
            ? !!body.announcement.enabled
            : (currentValue.announcement?.enabled || false),
          content: body.announcement.content !== undefined
            ? sanitizeAnnouncementHtml(String(body.announcement.content || ''))
            : (currentValue.announcement?.content || ''),
          displayType: body.announcement.displayType !== undefined
            ? (['modal', 'banner'].includes(body.announcement.displayType) ? body.announcement.displayType : 'modal')
            : (currentValue.announcement?.displayType || 'modal')
        }
      }
    }

    await db.settings.update(
      { key: 'appSettings' },
      {
        $set: {
          value: updatedValue,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    )

    return {
      success: true,
      message: '设置已保存',
      data: updatedValue
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Settings] 更新应用设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '保存设置失败'
    })
  }
})
