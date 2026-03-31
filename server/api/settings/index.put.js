import db from '../../utils/db.js'
import { requireAdmin } from '../../utils/auth.js'

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
        // 公告内容HTML净化，只允许安全标签和属性
        function sanitizeAnnouncementHtml(html = '') {
          // 安全白名单：仅允许的标签
          const allowedTags = ['p', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'span', 'br']
          // 仅允许的属性
          const allowedAttributes = ['href', 'target', 'style']
          // 仅允许的style属性
          const allowedStyles = ['color', 'background-color', 'font-size', 'font-weight', 'text-align']
          
          return String(html)
            // 移除所有script标签及其内容
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            // 移除所有iframe标签
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            // 移除所有on*事件属性
            .replace(/\s+on\w+="[^"]*"/gi, '')
            .replace(/\s+on\w+='[^']*'/gi, '')
            .replace(/\s+on\w+=\w+/gi, '')
            // 过滤标签
            .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
              tagName = tagName.toLowerCase()
              if (!allowedTags.includes(tagName)) {
                return ''
              }
              // 进一步过滤标签内的属性
              return match.replace(/\s+([a-z-]+)=["']([^"']*)["']/gi, (attrMatch, attrName, attrValue) => {
                attrName = attrName.toLowerCase()
                if (!allowedAttributes.includes(attrName)) {
                  return ''
                }
                // 过滤href属性，只允许http/https链接
                if (attrName === 'href' && !/^https?:\/\//i.test(attrValue)) {
                  return ''
                }
                // 过滤target属性，强制_blank并添加rel
                if (attrName === 'target') {
                  return ' target="_blank" rel="noopener noreferrer"'
                }
                // 过滤style属性
                if (attrName === 'style') {
                  const styles = attrValue.split(';').filter(style => {
                    const [key] = style.split(':').map(s => s.trim().toLowerCase())
                    return key && allowedStyles.includes(key)
                  })
                  return styles.length > 0 ? ` style="${styles.join('; ')}"` : ''
                }
                return attrMatch
              })
            })
            // 移除空标签
            .replace(/<([a-z][a-z0-9]*)\s*><\/\1>/gi, '')
            // 确保a标签都有rel属性
            .replace(/<a\b(?![^>]*\brel=)/gi, '<a rel="noopener noreferrer"')
        }

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
