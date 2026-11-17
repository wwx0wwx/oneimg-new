/**
 * 历史导出名兼容：testWebhook/testTelegram/testEmail/testServerChan
 * （外部 API 文件 notification/test.post.js 按这些名字导入）
 */
import { CHANNELS } from './channels/index.js'

export const testWebhook = (config) => CHANNELS.webhook.test(config)
export const testTelegram = (config) => CHANNELS.telegram.test(config)
export const testEmail = (config) => CHANNELS.email.test(config)
export const testServerChan = (config) => CHANNELS.serverchan.test(config)
