import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db from '../../utils/db.js'
import { requireAdmin, sanitizeUser, USER_ROLES } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const username = String(body.username || '').trim()
  const password = String(body.password || '').trim()

  if (username.length < 3) {
    throw createError({ statusCode: 400, message: '用户名至少 3 位' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: '密码至少 8 位' })
  }

  const exists = await db.users.findOne({ username })
  if (exists) {
    throw createError({ statusCode: 400, message: '用户名已存在' })
  }

  const user = {
    _id: uuidv4(),
    username,
    password: await bcrypt.hash(password, 10),
    role: USER_ROLES.USER,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.users.insert(user)

  return {
    success: true,
    message: '用户创建成功',
    data: sanitizeUser(user)
  }
})
