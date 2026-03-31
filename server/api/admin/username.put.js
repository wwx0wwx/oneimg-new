import db from '../../utils/db.js'
import { generateToken } from '../../utils/jwt.js'
import { requireAuthUser } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event)
    const body = await readBody(event)
    const username = String(body.username || '').trim()

    if (!username) {
      throw createError({
        statusCode: 400,
        message: '请输入新用户名'
      })
    }

    if (username.length < 3) {
      throw createError({
        statusCode: 400,
        message: '用户名长度至少 3 位'
      })
    }

    if (username !== user.username) {
      const existingUser = await db.users.findOne({ username })
      if (existingUser) {
        throw createError({ statusCode: 400, message: '用户名已存在' })
      }
    }

    await db.users.update(
      { _id: user._id },
      {
        $set: {
          username,
          updatedAt: new Date().toISOString()
        }
      }
    )

    const newToken = await generateToken({
      userId: user._id,
      username,
      role: user.role || 'user'
    })

    return {
      success: true,
      message: '用户名修改成功',
      data: {
        token: newToken,
        username
      }
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Account] 修改用户名失败:', error)
    throw createError({
      statusCode: 500,
      message: '修改用户名失败'
    })
  }
})
