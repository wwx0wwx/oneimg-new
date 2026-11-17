import Datastore from '@seald-io/nedb'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

// 数据目录（按优先级）：
// 1. ONEIMG_DATA_DIR/db（显式覆盖数据根目录，与上传目录 ONEIMG_DATA_DIR/uploads 对称）
// 2. 生产环境默认 /app/db（Docker 容器约定路径）
// 3. 开发环境默认项目根目录下 db/
// 注意：ONEIMG_DATA_DIR 指向"数据根目录"，库文件位于其下 db/ 子目录——
// 与 media.js 的 uploads 目录语义保持一致（历史上曾把该值直接当库目录，
// 导致设置后库文件散落到数据根目录，v1.3.3 修正）。
const dataDir = process.env.ONEIMG_DATA_DIR
  ? join(process.env.ONEIMG_DATA_DIR, 'db')
  : (process.env.NODE_ENV === 'production'
    ? '/app/db'
    : join(process.cwd(), 'db'))

// 确保 db 目录存在
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

console.log('[Database] 数据目录:', dataDir)

// 创建数据库实例
const users = new Datastore({
  filename: join(dataDir, 'users.db'),
  autoload: true
})

const images = new Datastore({
  filename: join(dataDir, 'images.db'),
  autoload: true
})

const apikeys = new Datastore({
  filename: join(dataDir, 'apikeys.db'),
  autoload: true
})

const settings = new Datastore({
  filename: join(dataDir, 'settings.db'),
  autoload: true
})

// 内容审核任务表
const moderationTasks = new Datastore({
  filename: join(dataDir, 'moderation_tasks.db'),
  autoload: true
})

// IP 黑名单表
const ipBlacklist = new Datastore({
  filename: join(dataDir, 'ip_blacklist.db'),
  autoload: true
})

// Promise 化数据库操作
const promisify = (db) => ({
  findOne: (query) => db.findOneAsync(query),
  find: (query) => db.findAsync(query),
  // 分页查询（排序/跳过/限量下推到存储层，避免全表读入内存再切片）
  findPage: (query, { sort, skip = 0, limit = 0 } = {}) =>
    new Promise((resolve, reject) => {
      let cursor = db.find(query)
      if (sort) cursor = cursor.sort(sort)
      if (skip > 0) cursor = cursor.skip(skip)
      if (limit > 0) cursor = cursor.limit(limit)
      cursor.exec((err, docs) => (err ? reject(err) : resolve(docs)))
    }),
  insert: (doc) => db.insertAsync(doc),
  update: (query, update, options = {}) => db.updateAsync(query, update, options),
  remove: (query, options = {}) => db.removeAsync(query, options),
  count: (query) => db.countAsync(query),
  ensureIndex: (options) => db.ensureIndexAsync(options)
})

export const db = {
  users: promisify(users),
  images: promisify(images),
  apikeys: promisify(apikeys),
  settings: promisify(settings),
  moderationTasks: promisify(moderationTasks),
  ipBlacklist: promisify(ipBlacklist)
}

export default db
