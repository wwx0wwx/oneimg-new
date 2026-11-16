import dns from 'dns/promises'
import net from 'net'

/**
 * 出站网络防护（共享工具）：
 * - isPrivateIp：统一的私网/保留地址判定（IPv4 + IPv6，含 IPv4-mapped 双形式）
 * - resolveOutboundAddr：解析并校验目标地址，返回可安全连接的 IP（用于固定 IP 连接，防 DNS rebinding）
 * - assertSafeOutboundUrl：出站请求前的地址校验（URL 导入 / Webhook / 审核服务共用）
 */

// 归一化 IP 字符串：
// - WHATWG URL 的 hostname 对 IPv6 字面量带方括号（如 "[::1]"），需先剥离
function normalizeIpForCheck(ip = '') {
  return String(ip || '').trim().replace(/^\[|\]$/g, '')
}

export function isPrivateIp(ip = '') {
  const normalized = normalizeIpForCheck(ip).toLowerCase()
  if (!normalized) return true

  // IPv4-mapped IPv6 → 按 IPv4 判断（两种写法都覆盖）：
  // - 点分形式：::ffff:127.0.0.1
  // - 十六进制形式：::ffff:7f00:1（Node 的 WHATWG URL 会把点分形式规范化成这种）
  const mappedDotted = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mappedDotted) return isPrivateIp(mappedDotted[1])
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16)
    const lo = parseInt(mappedHex[2], 16)
    return isPrivateIp([(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join('.'))
  }

  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split('.').map(Number)
    return a === 0                                   // 0.0.0.0/8 "this network"
      || a === 10                                    // 10.0.0.0/8
      || a === 127                                   // 127.0.0.0/8 loopback
      || (a === 100 && b >= 64 && b <= 127)          // 100.64.0.0/10 CGNAT
      || (a === 169 && b === 254)                    // 169.254.0.0/16 link-local（含云元数据）
      || (a === 172 && b >= 16 && b <= 31)           // 172.16.0.0/12
      || (a === 192 && b === 168)                    // 192.168.0.0/16
  }

  // IPv6
  return normalized === '::' || normalized === '::1'          // 未指定/回环
    || normalized.startsWith('::ffff:0:')                      // NAT64 ::ffff:0:0/96 映射段
    || normalized.startsWith('fc') || normalized.startsWith('fd')  // ULA fc00::/7
    || normalized.startsWith('fe80:')                          // link-local
    || normalized.startsWith('fec0:')                          // site-local（已废弃但仍应拒绝）
}

/**
 * 解析并校验出站地址。
 * @returns {Promise<{ip: string, family: number}>} 可安全连接的 IP
 * @throws createError(400) 当地址为私网/保留地址，或无法解析时
 */
export async function resolveOutboundAddr(hostnameRaw, { allowPrivate = false } = {}) {
  const hostname = normalizeIpForCheck(hostnameRaw).toLowerCase()

  if (net.isIP(hostname)) {
    if (!allowPrivate && isPrivateIp(hostname)) {
      throw createError({ statusCode: 400, message: '不允许访问本地或内网地址' })
    }
    return { ip: hostname, family: net.isIP(hostname) }
  }

  if (/^(localhost|.*\.local(?:host)?|.*\.internal)$/i.test(hostname)) {
    throw createError({ statusCode: 400, message: '不允许访问本地或内网地址' })
  }

  let records
  try {
    records = await dns.lookup(hostname, { all: true })
  } catch {
    throw createError({ statusCode: 400, message: '无法解析的主机名' })
  }

  const safe = records.find(r => allowPrivate || !isPrivateIp(r.address))
  if (!safe) {
    throw createError({ statusCode: 400, message: '不允许访问本地或内网地址' })
  }
  return { ip: safe.address, family: safe.family }
}

/**
 * 出站 URL 安全校验（Webhook / 审核服务等管理员可配目标）。
 * 与 URL 导入同标准：拒绝私网/回环/链路本地，仅允许 http(s)。
 */
export async function assertSafeOutboundUrl(rawUrl) {
  let url
  try {
    url = new URL(String(rawUrl))
  } catch {
    throw createError({ statusCode: 400, message: '无效的 URL' })
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw createError({ statusCode: 400, message: '仅允许 http/https 协议' })
  }
  await resolveOutboundAddr(url.hostname)
  return url
}

export { normalizeIpForCheck }
