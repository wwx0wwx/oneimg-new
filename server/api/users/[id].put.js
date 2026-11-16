import bcrypt from 'bcryptjs'
import db from '../../utils/db.js'
import { requireAdmin, sanitizeUser, USER_ROLES } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const user = await db.users.findOne({ _id: id })

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const updateData = { updatedAt: new Date().toISOString() }

  if (body.username !== undefined) {
    const username = String(body.username || '').trim()
    if (username.length < 3) {
      throw createError({ statusCode: 400, message: '用户名至少 3 位' })
    }
    const exists = await db.users.findOne({ username })
    if (exists && exists._id !== id) {
      throw createError({ statusCode: 400, message: '用户名已存在' })
    }
    updateData.username = username
  }

  if (body.password) {
    if (String(body.password).trim().length < 8) {
      throw createError({ statusCode: 400, message: '密码至少 8 位' })
    }
    updateData.password = await bcrypt.hash(String(body.password).trim(), 10)
    // 管理员重置密码 → 撤销该用户全部旧 token（显式 +1，兼容存量无字段用户）
    updateData.tokenVersion = (user.tokenVersion || 1) + 1
  }

  if (body.status !== undefined) {
    updateData.status = body.status === 'disabled' ? 'disabled' : 'active'
  }

  if (body.role !== undefined) {
    updateData.role = body.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.USER
  }

  if (id === admin._id && updateData.status === 'disabled') {
    throw createError({ statusCode: 400, message: '不能禁用当前管理员账户' })
  }

  await db.users.update({ _id: id }, { $set: updateData })
  const updated = await db.users.findOne({ _id: id })


  return {
    success: true,
    message: '用户更新成功',
    data: sanitizeUser(updated)
  }
})
