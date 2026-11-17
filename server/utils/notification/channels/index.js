/**
 * 渠道注册表：新增渠道（如钉钉）= 新增一个文件 + 在此注册一行。
 * 统一适配器接口：Channel = { send(config, payload), test(channelConfig) }
 */
import * as webhook from './webhook.js'
import * as telegram from './telegram.js'
import * as email from './email.js'
import * as serverchan from './serverchan.js'

export const CHANNELS = {
  webhook,
  telegram,
  email,
  serverchan
}
