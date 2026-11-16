import db from '../../utils/db.js'
import bcrypt from 'bcryptjs'
import { requireAuthUser } from '../../utils/auth.js'
import { generateToken } from '../../utils/jwt.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event)
    const body = await readBody(event)
    const { oldPassword, newPassword } = body

    if (!oldPassword || !newPassword) {
      throw createError({
        statusCode: 400,
        message: '请输入旧密码和新密码'
      })
    }

    if (newPassword.length < 8) {
      throw createError({
        statusCode: 400,
        message: '新密码长度至少 8 位'
      })
    }

    const dbUser = await db.users.findOne({ _id: user._id })
    if (!dbUser) {
      throw createError({ statusCode: 404, message: '用户不存在' })
    }

    const isValidPassword = await bcrypt.compare(oldPassword, dbUser.password)
    if (!isValidPassword) {
      throw createError({ statusCode: 400, message: '旧密码错误' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    // 显式递增 tokenVersion：修改密码后所有旧 token 立即失效。
    // （不用 $inc：存量用户无该字段时 0+1=1 与旧 token 的默认 tv=1 相等，撤销不生效）
    await db.users.update(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date().toISOString(),
          requirePasswordChange: false,
          tokenVersion: (user.tokenVersion || 1) + 1
        }
      }
    )

    // 当前会话换发新 token，避免改密后自己被登出
    const newToken = await generateToken({
      userId: user._id,
      username: user.username,
      role: user.role || 'user'
    })

    return {
      success: true,
      message: '密码修改成功',
      data: { token: newToken }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Account] 修改密码失败:', error)
    throw createError({
      statusCode: 500,
      message: '修改密码失败'
    })
  }
})
