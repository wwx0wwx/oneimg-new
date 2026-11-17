/**
 * Telegram 渠道：发送（优先本地图片 sendPhoto，失败回退链接消息）与连通性测试。
 */
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import TelegramBot from 'node-telegram-bot-api'
import { getMediaPath } from '../../media.js'
import { escapeMarkdown, isValidImageUrl } from '../template.js'

function buildTelegramMessage(payload, includeImageUrl = false) {
  let message = `*${escapeMarkdown(payload.title)}*\n${escapeMarkdown(payload.message)}`

  if (payload.data && Object.keys(payload.data).length > 0) {
    message += '\n\n*详细信息:*'
    for (const [key, value] of Object.entries(payload.data)) {
      // 跳过图片URL（除非明确要求包含）
      if (!includeImageUrl && (key === 'url' || key === 'imageUrl')) continue
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value
      message += `\n• ${key}: \`${escapeMarkdown(String(displayValue))}\``
    }
  }

  return message
}

/** 从本地文件系统读取图片（用于 sendPhoto） */
async function readLocalImage(filename) {
  try {
    const filepath = getMediaPath(filename)
    if (!existsSync(filepath)) {
      console.warn(`[Notification] 本地图片文件不存在: ${filepath}`)
      return null
    }
    return await readFile(filepath)
  } catch (error) {
    console.warn('[Notification] 读取本地图片出错:', error.message)
    return null
  }
}

function getExtensionFromContentType(contentType = '') {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg'
  }
  return map[contentType] || 'jpg'
}

function createBot(token) {
  const botOptions = {}
  const apiUrl = process.env.TELEGRAM_API_URL
  if (apiUrl) {
    botOptions.baseApiUrl = apiUrl
    console.log('[Notification] 使用自定义 Telegram API 地址:', apiUrl)
  }
  return new TelegramBot(token, botOptions)
}

export async function send(config, payload) {
  const { telegram } = config

  if (!telegram.token || !telegram.chatId) {
    console.warn('[Notification] Telegram Token 或 Chat ID 未配置')
    return { success: false, error: 'Telegram Token 或 Chat ID 未配置' }
  }

  try {
    console.log('[Notification] Telegram 通知预发送:', payload.title)

    const bot = createBot(telegram.token)
    const chatId = Number(telegram.chatId)

    const imageUrl = payload.data?.url || payload.data?.imageUrl
    const hasValidImageUrl = isValidImageUrl(imageUrl)

    // 优先尝试从本地读取图片文件
    const localFilename = payload.data?.filename
    let imageBuffer = null
    if (localFilename) {
      imageBuffer = await readLocalImage(localFilename)
    }

    if (imageBuffer) {
      const caption = buildTelegramMessage(payload, false)
      const format = payload.data?.format || getExtensionFromContentType('image/jpeg')
      const contentType = `image/${format === 'jpg' ? 'jpeg' : format}`

      try {
        await bot.sendPhoto(chatId, imageBuffer, {
          caption,
          parse_mode: 'Markdown'
        }, {
          filename: localFilename,
          contentType
        })
        console.log('[Notification] Telegram 图片通知发送成功:', payload.title)
      } catch (photoError) {
        // sendPhoto 失败回退到普通消息
        console.warn('[Notification] Telegram sendPhoto 失败，回退到普通消息:', photoError.message)
        let fallbackMessage = buildTelegramMessage(payload, true)
        if (hasValidImageUrl) {
          fallbackMessage += `\n\n🔗 [查看图片](${imageUrl})`
        }
        await bot.sendMessage(chatId, fallbackMessage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        })
      }
    } else if (hasValidImageUrl) {
      let fallbackMessage = buildTelegramMessage(payload, true)
      fallbackMessage += `\n\n🔗 [查看图片](${imageUrl})`
      await bot.sendMessage(chatId, fallbackMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    } else {
      const message = buildTelegramMessage(payload, true)
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    }

    console.log('[Notification] Telegram 通知发送成功:', payload.title)
    return { success: true }
  } catch (error) {
    console.error('[Notification] Telegram 发送失败:', error)
    return { success: false, error: error.message }
  }
}

export async function test(telegramConfig) {
  try {
    if (!telegramConfig.token || !telegramConfig.chatId) {
      return { success: false, error: '请提供 Token 和 Chat ID' }
    }

    const message = `*测试通知*\n这是一条测试通知，用于验证 Telegram 配置是否正确。\n\n_发送时间: ${new Date().toISOString()}_`
    const bot = createBot(telegramConfig.token)
    await bot.sendMessage(Number(telegramConfig.chatId), message, { parse_mode: 'Markdown' })
    return { success: true, message: '测试通知发送成功' }
  } catch (error) {
    console.error('[Notification] Telegram 测试失败:', error)
    return { success: false, error: error.message }
  }
}
