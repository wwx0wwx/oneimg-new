import { requireAdmin } from '../../utils/auth.js'
import { addToBlacklist } from '../../utils/ipBlacklist.js'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)
    const { ip, reason } = body

    if (!ip) {
      throw createError({
        statusCode: 400,
        message: '请输入 IP 地址'
      })
    }

    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){1,7}:$|^:([0-9a-fA-F]{1,4}:){1,7}$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$/

    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      throw createError({
        statusCode: 400,
        message: 'IP 地址格式不正确'
      })
    }

    const result = await addToBlacklist(ip, reason || '手动添加')
    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: result.error
      })
    }

    return {
      success: true,
      message: `IP ${ip} 已添加到黑名单`,
      data: result.record
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Blacklist] 添加黑名单失败:', error)
    throw createError({
      statusCode: 500,
      message: '添加黑名单失败'
    })
  }
})
