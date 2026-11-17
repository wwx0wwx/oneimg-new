import db from '../utils/db.js'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { startProcessor as startModerationProcessor, retryFailedTasks } from '../utils/moderationQueue.js'
import { getMediaPath } from '../utils/media.js'

// 定时任务间隔（毫秒）
const RETRY_FAILED_TASKS_INTERVAL = 60 * 60 * 1000  // 1 小时
const DAILY_MAINTENANCE_INTERVAL = 24 * 60 * 60 * 1000  // 1 天
const RECYCLE_BIN_RETENTION_DAYS = 30                  // 回收站保留天数
const MODERATION_TASK_RETENTION_DAYS = 7               // 已完结审核任务保留天数

/**
 * 每日维护：
 * - 清空回收站中软删除超过保留期的媒体（物理文件 + 记录）
 * - 清理已完结（completed/error）超过保留期的审核任务记录，防止无限累积
 */
async function dailyMaintenance() {
  try {
    const mediaCutoff = new Date(Date.now() - RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const expired = await db.images.find({ isDeleted: true, deletedAt: { $lt: mediaCutoff } })

    for (const image of expired) {
      try {
        const filePath = getMediaPath(image.filename)
        if (existsSync(filePath)) {
          await unlink(filePath)
        }
        await db.images.remove({ _id: image._id })
      } catch (err) {
        console.error(`[Scheduler] 回收站清理失败 ${image.uuid}:`, err.message)
      }
    }
    if (expired.length > 0) {
      console.log(`[Scheduler] 回收站已清理 ${expired.length} 个超过 ${RECYCLE_BIN_RETENTION_DAYS} 天的媒体`)
    }

    const taskCutoff = new Date(Date.now() - MODERATION_TASK_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const removedTasks = await db.moderationTasks.remove(
      { status: { $in: ['completed', 'error'] }, updatedAt: { $lt: taskCutoff } },
      { multi: true }
    )
    if (removedTasks > 0) {
      console.log(`[Scheduler] 已清理 ${removedTasks} 条过期审核任务记录`)
    }
  } catch (error) {
    console.error('[Scheduler] 每日维护出错:', error)
  }
}

// 重试失败的审核任务
async function retryFailedModerationTasks() {
  try {
    // 获取 error 状态的任务数量
    const failedCount = await db.moderationTasks.count({ status: 'failed' })

    if (failedCount === 0) {
      console.log('[Scheduler] 没有需要重试的失败审核任务')
      return
    }

    console.log(`[Scheduler] 发现 ${failedCount} 个失败的审核任务，开始重试...`)
    const result = await retryFailedTasks()
    console.log(`[Scheduler] 已重置 ${result.count} 个失败的审核任务`)
  } catch (error) {
    console.error('[Scheduler] 重试失败审核任务时出错:', error)
  }
}

export default defineNitroPlugin(() => {
  // 启动内容审核任务处理器
  startModerationProcessor()
  console.log('[Scheduler] 内容审核任务处理器已启动')

  // 启动定时任务：每小时重试失败的审核任务
  setInterval(() => {
    retryFailedModerationTasks()
  }, RETRY_FAILED_TASKS_INTERVAL)
  console.log('[Scheduler] 失败审核任务重试定时器已启动（每小时执行一次）')

  // 每日维护：回收站过期清理 + 审核任务记录清理
  dailyMaintenance()
  setInterval(dailyMaintenance, DAILY_MAINTENANCE_INTERVAL)
  console.log(`[Scheduler] 每日维护已启动（回收站保留${RECYCLE_BIN_RETENTION_DAYS}天/审核任务保留${MODERATION_TASK_RETENTION_DAYS}天）`)
})
