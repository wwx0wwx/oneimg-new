import net from 'net'
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

    // 用标准库校验（旧正则拒绝 ::1、::ffff:1.2.3.4 等常见 IPv6 写法，
    // 与自动拉黑入库的原样形态不一致，导致手动黑名单永远打不中）
    if (!net.isIP(String(ip))) {
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
