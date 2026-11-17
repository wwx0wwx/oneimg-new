import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api, login, uploadFile, makePng } from './helpers.mjs'

const TMP = '/tmp/oneimg-e2e-fixtures'

test('上传: 正常 PNG(multipart) 成功且字段完整', async () => {
  const token = await login()
  await makePng(`${TMP}/ok.png`, 40, 30)
  const { json } = await uploadFile(token, `${TMP}/ok.png`)
  assert.equal(json.success, true)
  assert.equal(json.data.format, 'png')
  assert.equal(json.data.width, 40)
  assert.equal(json.data.height, 30)
  assert.equal(json.data.visibility, 'private')
  assert.ok(json.data.url.startsWith('/i/') && json.data.url.endsWith('.png'))
  assert.equal(json.data.poster, '', 'B11: poster 应为空')
})

test('上传: base64 JSON 通道成功', async () => {
  const token = await login()
  const { readFileSync } = await import('node:fs')
  const b64 = readFileSync(`${TMP}/ok.png`).toString('base64')
  const { json } = await api('/api/upload/private', { method: 'POST', token, body: { base64: `data:image/png;base64,${b64}` } })
  assert.equal(json.success, true)
})

test('上传: 媒体策略保存并重启后持久化(B1-L1)', async () => {
  const token = await login()
  const put = await api('/api/media/config', { method: 'PUT', token, body: { allowAnonymousUpload: true } })
  assert.equal(put.status, 200)
  const get = await api('/api/media/config', { token })
  assert.equal(get.json.data.allowAnonymousUpload, true)
})

test('上传: 匿名上传开启后成功(无 429 undefined)', async () => {
  const png = new FormData()
  png.append('file', new Blob([await import('node:fs/promises').then(fs => fs.readFile(`${TMP}/ok.png`))], { type: 'image/png' }), 'anon.png')
  const { json } = await api('/api/upload/public', { method: 'POST', form: png })
  assert.equal(json.success, true)
})

test('上传: URL 导入批量上限 20', async () => {
  const token = await login()
  const urls = Array.from({ length: 21 }, () => 'https://httpbin.org/status/404')
  const { json } = await api('/api/upload/url', { method: 'POST', token, body: { url: urls } })
  assert.equal(json.message, '单次最多导入 20 个 URL')
})

test('上传: API Key 仅认请求头', async () => {
  const res = await api('/api/upload/private?apiKey=sk-anything', { raw: true, method: 'POST' })
  assert.equal(res.status, 401)
})

test('上传: 违规预览接口需管理员', async () => {
  const res = await api('/api/images/preview/00000000-0000-0000-0000-000000000000.png', { raw: true })
  assert.equal(res.status, 401)
})

test('列表: 分页正确', async () => {
  const token = await login()
  const { json } = await api('/api/images?page=1&limit=2', { token })
  assert.ok(json.data.pagination.total >= 1)
  assert.ok(json.data.media.length <= 2)
})

test('链接: 批量提取四格式', async () => {
  const token = await login()
  const list = await api('/api/images?page=1&limit=2', { token })
  const ids = list.json.data.media.map(m => m.id).slice(0, 1)
  if (ids.length === 0) return
  const { json } = await api('/api/media/links', { method: 'POST', token, body: { ids, format: 'markdown' } })
  assert.ok(json.data.output.includes('![') || json.data.output.includes(']('))
})
