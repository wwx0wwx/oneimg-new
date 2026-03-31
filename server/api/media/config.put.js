import { requireAdmin } from '../../utils/auth.js'
import { saveMediaConfig } from '../../utils/mediaConfig.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const config = await saveMediaConfig(body)
  return {
    success: true,
    message: '媒体配置已保存',
    data: config
  }
})
