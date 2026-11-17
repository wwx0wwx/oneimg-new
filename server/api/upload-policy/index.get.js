import { requireAdmin } from '../../utils/auth.js'
import { getUploadPolicy } from '../../utils/uploadPolicy.js'
import { maskSecret } from '../../utils/secretBox.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const policy = await getUploadPolicy()
  // providers 的 apiKey 一律脱敏回显（真值只在服务端 env/加密库中）
  const masked = {
    ...policy,
    contentSafety: {
      ...policy.contentSafety,
      providers: Object.fromEntries(
        Object.entries(policy.contentSafety?.providers || {}).map(([k, v]) => [
          k, { ...v, apiKey: maskSecret(v.apiKey || '') }
        ])
      )
    }
  }
  return { success: true, data: masked }
})
