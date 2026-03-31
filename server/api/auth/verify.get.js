import { requireAuthUser, sanitizeUser } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event)

    return {
      success: true,
      authenticated: true,
      data: {
        user: {
          ...sanitizeUser(user),
          requirePasswordChange: !!user.requirePasswordChange
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      authenticated: false,
      message: error.statusCode === 401 ? 'Token 无效或已过期' : '验证失败'
    }
  }
})
