// e2e 启动器：拉起隔离实例 → 提取初始密码 → 顺序执行 node --test → 清理
// 用法: node test/regression/run-e2e.mjs [--keep]（--keep 保留实例不杀）
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, rmSync, readdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const KEEP = process.argv.includes('--keep')
// 清理旧 e2e token 缓存（新实例新密码，旧 token 无效）
for (const f of readdirSync('/tmp').filter(f => f.startsWith('oneimg-e2e-tokens-'))) {
  try { unlinkSync('/tmp/' + f) } catch {}
}
const DATA_DIR = mkdtempSync(join(tmpdir(), 'oneimg-e2e-'))
const PORT = process.env.E2E_PORT || '8889'

const server = spawn('node', ['.output/server/index.mjs'], {
  env: { ...process.env, PORT, HOST: '127.0.0.1', ONEIMG_DATA_DIR: DATA_DIR },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout.on('data', d => { log += d })
server.stderr.on('data', d => { log += d })

async function waitForReady() {
  // 同时等待 HTTP 就绪与初始密码打印（db 初始化完成晚于 listen，存在时序差）
  for (let i = 0; i < 60; i++) {
    let httpOk = false
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/settings/public`, { signal: AbortSignal.timeout(1500) })
      httpOk = r.ok
    } catch {}
    if (httpOk && /OneImg@[A-Za-z0-9_-]+/.test(log)) return
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('实例未就绪:\n' + log.slice(-2000))
}

function cleanup() {
  if (!KEEP) {
    server.kill('SIGTERM')
    setTimeout(() => { try { rmSync(DATA_DIR, { recursive: true, force: true }) } catch {} }, 500)
  }
}
process.on('exit', cleanup)
process.on('SIGINT', () => { cleanup(); process.exit(130) })

try {
  await waitForReady()
  const pw = log.match(/OneImg@[A-Za-z0-9_-]+/)?.[0]
  if (!pw) throw new Error('未找到初始密码')
  console.log(`[e2e] 实例就绪 http://127.0.0.1:${PORT} (数据: ${DATA_DIR})`)

  execSync(`node --test --test-concurrency=1 --test-reporter=spec test/regression/security.test.mjs test/regression/upload.test.mjs test/regression/uploadPolicy.test.mjs`, {
    stdio: 'inherit',
    env: { ...process.env, BASE_URL: `http://127.0.0.1:${PORT}`, E2E_ADMIN_PASSWORD: pw },
  })
  process.exitCode = 0
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
} finally {
  cleanup()
}
