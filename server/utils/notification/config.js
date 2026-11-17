/**
 * 通知配置管理：默认值、读取（含解密）、保存（含加密）、脱敏展示。
 * 通知模块中唯一接触 secretBox（加解密）的文件。
 */
import db from '../db.js'
import { encryptSecret, decryptSecret, maskSecret } from '../secretBox.js'

// 通知类型枚举
export const NOTIFICATION_TYPES = {
  LOGIN: 'login',           // 登录通知
  UPLOAD: 'upload',         // 图片上传通知
  NSFW_DETECTED: 'nsfw',    // 鉴黄检测结果通知
}

// 通知方式枚举
export const NOTIFICATION_METHODS = {
  WEBHOOK: 'webhook',
  TELEGRAM: 'telegram',
  EMAIL: 'email',
  SERVERCHAN: 'serverchan',
}

// 默认通知配置
export function getDefaultNotificationConfig() {
  return {
    enabled: false,
    method: NOTIFICATION_METHODS.TELEGRAM,
    // 各类型通知开关（默认全部开启）
    types: {
      [NOTIFICATION_TYPES.LOGIN]: true,
      [NOTIFICATION_TYPES.UPLOAD]: true,
      [NOTIFICATION_TYPES.NSFW_DETECTED]: true,
    },
    // Webhook 配置
    webhook: {
      url: '',
      method: 'POST',
      contentType: 'application/json',
      headers: {},  // 自定义请求头，如 { "Authorization": "Bearer xxx" }
      // 请求体模板，支持变量替换
      // 可用变量: {{type}}, {{title}}, {{message}}, {{timestamp}}, {{data}}
      bodyTemplate: JSON.stringify({
        type: '{{type}}',
        title: '{{title}}',
        message: '{{message}}',
        timestamp: '{{timestamp}}',
        data: '{{data}}'
      }, null, 2)
    },
    // Telegram 配置
    telegram: {
      token: '',    // Bot Token
      chatId: ''    // Chat ID
    },
    // Email 配置
    email: {
      service: '',  // 邮件服务商，如 'gmail', 'qq', '163' 等
      user: '',     // 发件人邮箱
      pass: '',     // 邮箱授权码/密码
      to: ''        // 收件人邮箱（可选，默认发送给自己）
    },
    // Server酱 配置
    serverchan: {
      sendKey: ''   // Server酱 SendKey
    }
  }
}

/**
 * 获取通知配置（敏感字段解密后供发送方使用）
 */
export async function getNotificationConfig() {
  try {
    const configDoc = await db.settings.findOne({ key: 'notificationConfig' })
    if (configDoc?.value) {
      // 合并默认配置，确保新增字段有默认值；敏感字段解密后供发送方使用
      const defaultConfig = getDefaultNotificationConfig()
      const decrypted = {
        ...configDoc.value,
        telegram: { ...configDoc.value.telegram },
        email: { ...configDoc.value.email },
        serverchan: { ...configDoc.value.serverchan }
      }
      decrypted.telegram.token = await decryptSecret(decrypted.telegram.token || '')
      decrypted.email.pass = await decryptSecret(decrypted.email.pass || '')
      decrypted.serverchan.sendKey = await decryptSecret(decrypted.serverchan.sendKey || '')
      configDoc.value = decrypted
      return {
        ...defaultConfig,
        ...configDoc.value,
        types: {
          ...defaultConfig.types,
          ...configDoc.value.types
        },
        webhook: {
          ...defaultConfig.webhook,
          ...configDoc.value.webhook
        },
        telegram: {
          ...defaultConfig.telegram,
          ...configDoc.value.telegram
        },
        email: {
          ...defaultConfig.email,
          ...configDoc.value.email
        },
        serverchan: {
          ...defaultConfig.serverchan,
          ...configDoc.value.serverchan
        }
      }
    }
    return getDefaultNotificationConfig()
  } catch (error) {
    console.error('[Notification] 获取配置失败:', error)
    return getDefaultNotificationConfig()
  }
}

/**
 * 保存通知配置（敏感字段 AES-256-GCM 加密落库）
 */
export async function saveNotificationConfig(config) {
  try {
    const encrypted = JSON.parse(JSON.stringify(config))
    encrypted.telegram = { ...encrypted.telegram }
    encrypted.email = { ...encrypted.email }
    encrypted.serverchan = { ...encrypted.serverchan }
    encrypted.telegram.token = await encryptSecret(encrypted.telegram.token || '')
    encrypted.email.pass = await encryptSecret(encrypted.email.pass || '')
    encrypted.serverchan.sendKey = await encryptSecret(encrypted.serverchan.sendKey || '')
    config = encrypted
    await db.settings.update(
      { key: 'notificationConfig' },
      {
        $set: {
          value: config,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    )
    return { success: true }
  } catch (error) {
    console.error('[Notification] 保存配置失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取脱敏后的通知配置（管理端展示用）：敏感字段只保留尾 4 位
 */
export async function getNotificationConfigMasked() {
  const config = await getNotificationConfig()
  return {
    ...config,
    telegram: { ...config.telegram, token: maskSecret(config.telegram.token) },
    email: { ...config.email, pass: maskSecret(config.email.pass) },
    serverchan: { ...config.serverchan, sendKey: maskSecret(config.serverchan.sendKey) }
  }
}
