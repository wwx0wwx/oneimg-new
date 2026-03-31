import db from '../utils/db.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { getDefaultContentSafetyConfig } from '../utils/moderation.js'
import { saveMediaConfig, DEFAULT_MEDIA_CONFIG } from '../utils/mediaConfig.js'

async function initDefaultUser() {
  const existingAdmin = await db.users.findOne({ role: 'admin' })

  if (!existingAdmin) {
    const defaultUsername = 'oneimg-admin'
    const temporaryPassword = `OneImg@${Math.random().toString(36).slice(2, 10)}`
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10)
    await db.users.insert({
      _id: uuidv4(),
      username: defaultUsername,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requirePasswordChange: true
    })
    console.warn(`[Database] 已初始化 OneImg 管理员账户，请立即登录后修改密码 (用户名: ${defaultUsername}, 临时密码: ${temporaryPassword})`)
  }
}

async function initJwtSecret() {
  let jwtSetting = await db.settings.findOne({ key: 'jwtSecret' })

  if (!process.env.JWT_SECRET && !jwtSetting) {
    const secret = crypto.randomBytes(64).toString('hex')
    await db.settings.insert({
      _id: uuidv4(),
      key: 'jwtSecret',
      value: secret,
      createdAt: new Date().toISOString()
    })
    console.log('[Database] JWT 密钥已生成并持久化')
    jwtSetting = { value: secret }
  }

  if (process.env.JWT_SECRET) {
    console.log('[Database] 使用环境变量中的 JWT 密钥')
  }
}

async function initDefaultApiKey() {
  const existingKey = await db.apikeys.findOne({ isDefault: true })
  if (!existingKey) {
    const defaultAdmin = await db.users.findOne({ role: 'admin', status: { $ne: 'disabled' } })
    const apiKey = `sk-${uuidv4().replace(/-/g, '')}`
    await db.apikeys.insert({
      _id: uuidv4(),
      key: apiKey,
      name: '默认密钥',
      isDefault: true,
      enabled: true,
      ownerUserId: defaultAdmin?._id || null,
      ownerUsername: defaultAdmin?.username || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    console.log('[Database] 默认 API Key 已创建')
  }
}

async function initPublicApiConfig() {
  const existingConfig = await db.settings.findOne({ key: 'publicApiConfig' })
  if (!existingConfig) {
    await db.settings.insert({
      _id: uuidv4(),
      key: 'publicApiConfig',
      value: {
        enabled: false,
        allowedFormats: DEFAULT_MEDIA_CONFIG.allowedExtensions,
        maxFileSize: DEFAULT_MEDIA_CONFIG.anonymousMaxFileSize,
        enableCompression: false,
        compressionQuality: 80,
        convertToWebp: false,
        convertToPng: false,
        rateLimit: 10,
        allowConcurrent: false,
        contentSafety: getDefaultContentSafetyConfig()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    console.log('[Database] 公共上传配置已初始化')
  }
}

async function initPrivateApiConfig() {
  const existingConfig = await db.settings.findOne({ key: 'privateApiConfig' })
  if (!existingConfig) {
    await db.settings.insert({
      _id: uuidv4(),
      key: 'privateApiConfig',
      value: {
        maxFileSize: DEFAULT_MEDIA_CONFIG.userMaxFileSize,
        enableCompression: false,
        compressionQuality: 80,
        convertToWebp: false,
        convertToPng: false,
        rateLimit: 100,
        maxConcurrent: 5,
        showOnHomepage: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    console.log('[Database] 登录上传配置已初始化')
  }
}

async function initAppSettings() {
  const existingSettings = await db.settings.findOne({ key: 'appSettings' })
  if (!existingSettings) {
    await db.settings.insert({
      _id: uuidv4(),
      key: 'appSettings',
      value: {
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
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    console.log('[Database] 应用设置已初始化')
  }
}

async function initMediaConfig() {
  const existingConfig = await db.settings.findOne({ key: 'mediaConfig' })
  if (!existingConfig) {
    await saveMediaConfig(DEFAULT_MEDIA_CONFIG)
    console.log('[Database] 媒体配置已初始化')
    return
  }

  await saveMediaConfig(existingConfig.value || {})
}

async function createIndexes() {
  await db.users.ensureIndex({ fieldName: 'username', unique: true })
  await db.images.ensureIndex({ fieldName: 'uuid', unique: true })
  await db.images.ensureIndex({ fieldName: 'uploadedAt' })
  await db.images.ensureIndex({ fieldName: 'isDeleted' })
  await db.images.ensureIndex({ fieldName: 'uploadedBy' })
  await db.images.ensureIndex({ fieldName: 'ownerId' })
  await db.images.ensureIndex({ fieldName: 'visibility' })
  await db.images.ensureIndex({ fieldName: 'mediaType' })
  await db.images.ensureIndex({ fieldName: 'moderationStatus' })
  await db.images.ensureIndex({ fieldName: 'isNsfw' })
  await db.apikeys.ensureIndex({ fieldName: 'key', unique: true })
  await db.apikeys.ensureIndex({ fieldName: 'ownerUserId' })
  await db.settings.ensureIndex({ fieldName: 'key', unique: true })
  await db.moderationTasks.ensureIndex({ fieldName: 'imageId' })
  await db.moderationTasks.ensureIndex({ fieldName: 'status' })
  await db.moderationTasks.ensureIndex({ fieldName: 'createdAt' })
  await db.ipBlacklist.ensureIndex({ fieldName: 'ip', unique: true })
  await db.ipBlacklist.ensureIndex({ fieldName: 'createdAt' })
  console.log('[Database] 数据库索引已创建')
}

export async function initDatabase() {
  try {
    await createIndexes()
    await initDefaultUser()
    await initJwtSecret()
    await initDefaultApiKey()
    await initPublicApiConfig()
    await initPrivateApiConfig()
    await initAppSettings()
    await initMediaConfig()
    console.log('[Database] 数据库初始化完成')
  } catch (error) {
    console.error('[Database] 数据库初始化失败:', error)
    throw error
  }
}

export default defineNitroPlugin(async () => {
  await initDatabase()
})
