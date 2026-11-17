import { requireAdmin } from '../../utils/auth.js'
import { getUploadPolicy, saveUploadPolicy, syncLegacyKeys } from '../../utils/uploadPolicy.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const current = await getUploadPolicy()
  const saved = await saveUploadPolicy({ ...current, ...body })
  await syncLegacyKeys(saved)
  return { success: true, message: '上传策略已保存', data: saved }
})
