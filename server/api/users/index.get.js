import db from '../../utils/db.js'
import { requireAdmin, sanitizeUser } from '../../utils/auth.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const users = await db.users.find({})
  users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return {
    success: true,
    data: users.map(sanitizeUser)
  }
})
