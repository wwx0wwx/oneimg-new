import Datastore from '@seald-io/nedb'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

// 数据目录（按优先级）：
// 1. ONEIMG_DATA_DIR 环境变量（显式覆盖，便于隔离部署/备份/多实例）
// 2. 生产环境默认 /app/db（Docker 容器约定路径）
// 3. 开发环境默认项目根目录下 db/
// 注意：Nitro 构建会将 process.env.NODE_ENV 内联为字面量，
// 因此生产/开发的切换在构建产物中是固定的，运行时只能靠 ONEIMG_DATA_DIR 覆盖。
const dataDir = process.env.ONEIMG_DATA_DIR
  || (process.env.NODE_ENV === 'production'
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
