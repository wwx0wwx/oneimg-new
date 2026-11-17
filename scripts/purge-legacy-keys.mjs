#!/usr/bin/env node
/**
 * 旧配置键出清脚本（v2.2 清理期）。
 *
 * 用途：删除 settings.db 中已废弃的三个旧配置键
 *   mediaConfig / publicApiConfig / privateApiConfig
 * （其内容已在 v2.1.0/v2.2.0 启动时合并进唯一的 uploadPolicy 键）
 *
 * 使用方法（必须先停止应用进程，避免 NeDB 并发写入）：
 *   systemctl stop oneimg            # 或你的进程管理方式
 *   ONEIMG_DATA_DIR=/app node scripts/purge-legacy-keys.mjs
 *   systemctl start oneimg
 *
 * 注意：出清后如需回滚到 v2.1.x 之前的版本，旧版本将读到默认配置
 * （uploadPolicy 键仍在，v2.1.x 可正常读取；v1.x 读不到旧键）。
 * 执行前建议备份 settings.db。
 */
import Datastore from '@seald-io/nedb'
import { join } from 'path'
import { copyFileSync, existsSync } from 'fs'

const LEGACY_KEYS = ['mediaConfig', 'publicApiConfig', 'privateApiConfig']
const dataDir = process.env.ONEIMG_DATA_DIR
  ? join(process.env.ONEIMG_DATA_DIR, 'db')
  : (process.env.NODE_ENV === 'production' ? '/app/db' : join(process.cwd(), 'db'))

const settingsFile = join(dataDir, 'settings.db')
if (!existsSync(settingsFile)) {
  console.error(`未找到 ${settingsFile}（检查 ONEIMG_DATA_DIR 是否正确）`)
  process.exit(1)
}

// 自动备份
const backupFile = settingsFile + '.bak-' + Date.now()
copyFileSync(settingsFile, backupFile)

const store = new Datastore({ filename: settingsFile, autoload: true })

const uploadPolicy = await store.findOneAsync({ key: 'uploadPolicy' })
if (!uploadPolicy?.value) {
  console.error('未检测到 uploadPolicy 键——请先用 v2.2.0 启动一次完成迁移，再执行出清。')
  process.exit(1)
}

let removed = 0
for (const key of LEGACY_KEYS) {
  const n = await store.removeAsync({ key }, { multi: true })
  removed += n
  console.log(`  ${key}: 删除 ${n} 条记录`)
}

await store.compactDatafileAsync()
console.log(`\n完成：共删除 ${removed} 条旧配置记录`)
console.log(`备份：${backupFile}`)
console.log('现在可以启动应用：systemctl start oneimg')
