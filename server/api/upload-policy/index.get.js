import { requireAdmin } from '../../utils/auth.js'
import { getUploadPolicy } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { success: true, data: await getUploadPolicy() }
})
