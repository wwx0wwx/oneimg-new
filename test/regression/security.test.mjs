import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api, login, uploadFile, makePng } from './helpers.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const TMP = '/tmp/oneimg-e2e-fixtures'
mkdirSync(TMP, { recursive: true })

test('安全: SSRF 向量全部拦截', async () => {
  const token = await login()
  // 注意保持 URL 导入总调用 ≤10 次/分钟（限速），完整向量覆盖见 unit/netGuard 测试
  const vectors = [
    'http://127.0.0.1:1/x.png', 'http://[::1]:1/x.png',
    'http://[::ffff:7f00:1]:1/x.png', 'http://0.0.0.0/',
    'http://169.254.169.254/latest/', 'http://100.64.0.1/x',
    'http://192.168.1.1/x.png', 'http://[2002:7f00::1]/x.png'
  ]
  for (const url of vectors) {
    const { json } = await api('/api/upload/url', { method: 'POST', token, body: { url } })
    assert.equal(json?.message, '不允许访问本地或内网地址', `应拦截: ${url}`)
  }
})

test('安全: SVG 直链 attachment + CSP', async () => {
  const token = await login()
  writeFileSync(`${TMP}/x.svg`, '<svg xmlns="http://www.w3.org/2000/svg"><text x="1" y="2">t</text></svg>')
  const { json } = await uploadFile(token, `${TMP}/x.svg`)
  assert.equal(json.success, true)
  const res = await api(json.data.url, { token, raw: true })
  assert.equal(res.headers.get('content-disposition')?.startsWith('attachment'), true)
  assert.ok(res.headers.get('content-security-policy')?.includes('sandbox'))
})

test('安全: 垃圾字节伪装媒体被拒(S1)', async () => {
  const token = await login()
  writeFileSync(`${TMP}/garbage.png`, 'PNG' + Math.random().toString(36).slice(2))
  const { status } = await uploadFile(token, `${TMP}/garbage.png`, { mime: 'image/png' })
  assert.equal(status, 400)
})

test('安全: MIME 与扩展名精确匹配(S2)', async () => {
  const token = await login()
  await makePng(`${TMP}/real.png`)
  const { status } = await uploadFile(token, `${TMP}/real.png`, { mime: 'image/jpeg' })
  assert.equal(status, 400)
})

test('安全: 公告净化(javascript: 全形态剥除)', async () => {
  const token = await login()
  const payload = { announcement: { enabled: true, displayType: 'banner', content: '<a href=javascript:alert(1)>a</a><a href="javascript:alert(1)">b</a><p>ok <strong>x</strong></p><a href="https://ok.com">c</a>' } }
  const { json } = await api('/api/settings', { method: 'PUT', token, body: payload })
  const html = json.data.announcement.content
  assert.ok(!html.includes('javascript:'), 'javascript: 应被剥除')
  assert.ok(html.includes('https://ok.com'), '正常链接保留')
  assert.ok(html.includes('<strong>'), '安全标签保留')
})

test('安全: NeDB 操作符注入返回 400', async () => {
  const res = await api('/api/auth/login', { method: 'POST', body: { username: { $regex: '^x' }, password: 'y' }, raw: true })
  assert.equal(res.status, 400)
})

test('安全: 通知密钥落库加密 + GET/PUT 脱敏(S4/L3)', async () => {
  const token = await login()
  const put = await api('/api/notification', { method: 'PUT', token, body: { enabled: false, method: 'telegram', telegram: { token: 'E2EMask-Test-9999', chatId: '1' } } })
  assert.equal(put.json.data.telegram.token, '****9999', 'PUT 响应脱敏')
  const get = await api('/api/notification', { token })
  assert.equal(get.json.data.telegram.token, '****9999', 'GET 脱敏')
})

test('安全: webhook 内网目标被拒(pinnedFetch)', async () => {
  const token = await login()
  const { json } = await api('/api/notification/test', { method: 'POST', token, body: { method: 'webhook', webhook: { url: 'http://192.168.0.9/hook' } } })
  assert.ok(json.message?.includes('不允许访问本地或内网地址'))
})

test('安全: 越权矩阵(普通用户 403/未认证 401)', async () => {
  const token = await login()
  await api('/api/users', { method: 'POST', token, body: { username: 'e2euser', password: 'e2e-pass-1' } })
  const ut = await login('e2euser', 'e2e-pass-1')
  assert.equal((await api('/api/users', { token: ut })).status, 403)
  assert.equal((await api('/api/settings', { token: ut })).status, 403)
  assert.equal((await api('/api/settings', {})).status, 401)
  assert.equal((await api('/api/users', {})).status, 401)
})

test('安全: tokenVersion 改密撤销', async () => {
  const token = await login()
  await api('/api/users', { method: 'POST', token: await login(), body: { username: 'e2etk', password: 'e2etk-pass1' } })
  const ut = await login('e2etk', 'e2etk-pass1')
  assert.equal((await api('/api/settings', { token: ut })).status, 403, '改密前 token 有效(403=已认证无权限)')
  await api('/api/admin/password', { method: 'PUT', token: ut, body: { oldPassword: 'e2etk-pass1', newPassword: 'e2etk-pass2' } })
  assert.equal((await api('/api/settings', { token: ut })).status, 401, '改密后旧 token 401')
})
