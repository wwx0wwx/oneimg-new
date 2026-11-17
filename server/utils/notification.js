/**
 * 兼容转发文件：v2.1.0 目录化拆分后保持 `utils/notification.js` 的既有引用不变。
 * 计划于 v2.2 清理期删除（调用方届时直接指向 notification/index.js）。
 */
export {
  NOTIFICATION_TYPES,
  NOTIFICATION_METHODS,
  getDefaultNotificationConfig,
  getNotificationConfig,
  getNotificationConfigMasked,
  saveNotificationConfig,
  sendNotification,
  sendLoginNotification,
  sendUploadNotification,
  sendNsfwNotification,
  testWebhook,
  testTelegram,
  testEmail,
  testServerChan
} from './notification/index.js'
export { default } from './notification/index.js'
