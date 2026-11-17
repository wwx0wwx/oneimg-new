// e2e 共享工具：登录/HTTP 封装（需环境变量 BASE_URL、E2E_ADMIN_PASSWORD）
export const BASE = process.env.BASE_URL || 'http://127.0.0.1:8889'
export const ADMIN_PW = process.env.E2E_ADMIN_PASSWORD

export async function api(path, { method = 'GET', token, body, form, headers = {}, raw = false } = {}) {
  const opts = { method, headers: { ...headers } }
  if (token) opts.headers.Authorization = `Bearer ${token}`
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  if (form) opts.body = form
  const res = await fetch(BASE + path, opts)
  if (raw) return res
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json, res }
}

// 登录限速为每 IP 5 次/分钟：e2e 内按用户缓存 token，避免测试自身触发 429
const tokenCache = new Map()
export async function login(username = 'oneimg-admin', password = ADMIN_PW) {
  const key = `${username}:${password}`
  if (tokenCache.has(key)) return tokenCache.get(key)
  const { json } = await api('/api/auth/login', { method: 'POST', body: { username, password } })
  if (!json?.data?.token) throw new Error('登录失败: ' + JSON.stringify(json))
  tokenCache.set(key, json.data.token)
  return json.data.token
}

// 按扩展名推断 MIME（multipart 中无 type 的 Blob 会带出错误的 part Content-Type）
const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp',
  ico: 'image/x-icon', apng: 'image/apng', tiff: 'image/tiff',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
}

export async function uploadFile(token, filePath, { field = 'file', mime, filename } = {}) {
  const fd = new FormData()
  const fs = await import('node:fs/promises')
  const buf = await fs.readFile(filePath)
  const name = filename || filePath.split('/').pop()
  const type = mime || MIME_BY_EXT[name.split('.').pop()?.toLowerCase()] || 'application/octet-stream'
  fd.append(field, new Blob([buf], { type }), name)
  return api('/api/upload/private', { method: 'POST', token, form: fd })
}

// 生成真 PNG（sharp）
export async function makePng(path, w = 8, h = 8) {
  const sharp = (await import('sharp')).default
  await sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 100, b: 50 } } }).png().toFile(path)
}
