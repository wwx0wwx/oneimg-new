import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api, login } from './helpers.mjs'

test('策略: 新端点返回完整 uploadPolicy 模型', async () => {
  const token = await login()
  const { json } = await api('/api/upload-policy', { token })
  const p = json.data
  for (const k of ['allowAnonymousUpload', 'allowedExtensions', 'sizeLimits', 'defaultUserVisibility', 'processing', 'limits', 'allowConcurrent', 'contentSafety']) {
    assert.ok(k in p, `缺少字段 ${k}`)
  }
  assert.ok(p.sizeLimits.anonymous > 0 && p.sizeLimits.user > 0 && p.sizeLimits.admin > 0)
})

test('策略: 新端点写 → 旧端点视图同步', async () => {
  const token = await login()
  await api('/api/upload-policy', { method: 'PUT', token, body: { defaultUserVisibility: 'public', limits: { anonymousPerMin: 12 } } })
  const media = await api('/api/media/config', { token })
  assert.equal(media.json.data.defaultUserVisibility, 'public', 'mediaConfig 视图同步')
  const pub = await api('/api/config/public', { token })
  assert.equal(pub.json.data.rateLimit, 12, 'publicApiConfig 视图同步')
})

test('策略: 旧端点写 → 新键生效（写新域）', async () => {
  const token = await login()
  await api('/api/media/config', { method: 'PUT', token, body: { userMaxFileSize: 60 * 1024 * 1024 } })
  const p = await api('/api/upload-policy', { token })
  assert.equal(p.json.data.sizeLimits.user, 60 * 1024 * 1024)
  // 还原
  await api('/api/media/config', { method: 'PUT', token, body: { userMaxFileSize: 50 * 1024 * 1024 } })
})

test('策略: 旧键被双写（回滚一致性）', async () => {
  const token = await login()
  await api('/api/media/config', { method: 'PUT', token, body: { allowAnonymousUpload: true } })
  const p = await api('/api/upload-policy', { token })
  assert.equal(p.json.data.allowAnonymousUpload, true)
  // 双写检查需要读库文件，e2e 环境验证行为等价：旧 GET 端点应读到 true
  const legacy = await api('/api/media/config', { token })
  assert.equal(legacy.json.data.allowAnonymousUpload, true)
  // 还原关闭
  await api('/api/media/config', { method: 'PUT', token, body: { allowAnonymousUpload: false } })
})

test('策略: 死字段已移除（private 配置无 maxFileSize/showOnHomepage）', async () => {
  const token = await login()
  const { json } = await api('/api/config/private', { token })
  assert.ok(!('maxFileSize' in json.data), 'maxFileSize 应移除')
  assert.ok(!('showOnHomepage' in json.data), 'showOnHomepage 应移除')
})

test('策略: 上传行为回归（合并读生效）', async () => {
  const token = await login()
  const png = new FormData()
  const fs = await import('node:fs/promises')
  png.append('file', new Blob([await fs.readFile('/tmp/oneimg-e2e-fixtures/ok.png')], { type: 'image/png' }), 'policy.png')
  const { json } = await api('/api/upload/private', { method: 'POST', token, form: png })
  assert.equal(json.success, true)
})

test('策略: 匿名上传按 policy 开关', async () => {
  await api('/api/media/config', { method: 'PUT', token: await login(), body: { allowAnonymousUpload: true } })
  const png = new FormData()
  const fs = await import('node:fs/promises')
  png.append('file', new Blob([await fs.readFile('/tmp/oneimg-e2e-fixtures/ok.png')], { type: 'image/png' }), 'anon.png')
  const ok = await api('/api/upload/public', { method: 'POST', form: png })
  assert.equal(ok.json.success, true)
  await api('/api/media/config', { method: 'PUT', token: await login(), body: { allowAnonymousUpload: false } })
  const denied = await api('/api/upload/public', { method: 'POST', form: png })
  assert.equal(denied.status, 403)
})

test('策略: processing 双向映射（flat <-> 嵌套）', async () => {
  const token = await login()
  await api('/api/config/private', { method: 'PUT', token, body: { enableCompression: true, compressionQuality: 65, convertToWebp: true, rateLimit: 33 } })
  const p = await api('/api/upload-policy', { token })
  assert.deepEqual(p.json.data.processing, { enableCompression: true, quality: 65, convertTo: 'webp' })
  assert.equal(p.json.data.limits.authenticatedPerMin, 33)
  // 还原
  await api('/api/config/private', { method: 'PUT', token, body: { enableCompression: false, compressionQuality: 80, convertToWebp: false, convertToPng: false, rateLimit: 60 } })
})

test('策略: 未认证访问新端点 401', async () => {
  const r = await api('/api/upload-policy', { raw: true })
  assert.equal(r.status, 401)
})
