import db from '../../utils/db.js'
import { generateToken } from '../../utils/jwt.js'
import bcrypt from 'bcryptjs'
import { sendLoginNotification } from '../../utils/notification.js'
import { checkRateLimit } from '../../utils/rateLimit.js'

export default defineEventHandler(async (event) => {
  try {
    const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    // 登录使用独立的低限速（每 IP 每分钟 5 次），不与上传限速配置耦合，
    // 防止管理端把 privateApiConfig.rateLimit 调大后登录接口跟着失去爆破防护
    const rateLimitResult = await checkRateLimit('login', `login:${clientIP}`, { limit: 5 })
    if (!rateLimitResult.allowed) {
      throw createError({
        statusCode: 429,
        message: `登录尝试过于频繁，请 ${rateLimitResult.retryAfter ?? 60} 秒后重试`
      })
    }

    const body = await readBody(event)
    const { username, password } = body

    if (!username || !password) {
      throw createError({
        statusCode: 400,
        message: '用户名和密码不能为空'
      })
    }

    // 类型必须为字符串：防止 NeDB 查询操作符注入（如 {"$regex":...}）打进查询层
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw createError({
        statusCode: 400,
        message: '用户名或密码格式错误'
      })
    }

    // 查找用户
    const user = await db.users.findOne({ username })
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '用户名或密码错误'
      })
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      throw createError({
        statusCode: 401,
        message: '用户名或密码错误'
      })
    }

    if (user.status === 'disabled') {
      throw createError({
        statusCode: 403,
        message: '该账户已被禁用'
      })
    }

    await db.users.update(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    )

    // 生成 Token
    const token = await generateToken({
      userId: user._id,
      username: user.username,
      role: user.role || 'user'
    })

    // 发送登录通知（异步，不阻塞响应）
    const userAgent = getHeader(event, 'user-agent') || 'unknown'
    sendLoginNotification(user.username, clientIP, userAgent).catch(err => {
      console.error('[Login] 发送登录通知失败:', err)
    })

    return {
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role || 'user',
          status: user.status || 'active',
          requirePasswordChange: !!user.requirePasswordChange
        }
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }
    // 500 不回显内部错误细节，避免向外部探测者泄露实现信息
    console.error('[Login] 登录处理异常:', error)
    throw createError({
      statusCode: 500,
      message: '登录失败，请稍后重试'
    })
  }
})
