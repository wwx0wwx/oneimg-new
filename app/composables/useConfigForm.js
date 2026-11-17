import { ref, reactive, toRaw } from 'vue'
import { useToastStore } from '~/stores/toast'

/**
 * 配置表单通用生命周期：加载 → 编辑 → 保存 → toast。
 * 收敛管理面板中重复三遍的 fetch→Object.assign→save→提示 模式。
 *
 * @param {object} options
 * @param {object} options.defaults 表单默认值（结构模板）
 * @param {() => Promise<object|null>} options.fetcher 返回要合并进表单的数据
 * @param {(form: object) => Promise<{success:boolean,message?:string}>} options.saver
 * @param {string} options.successMessage 保存成功提示
 * @param {(form: object) => void} [options.afterLoad] 加载后的修正钩子（如数组兜底）
 */
export function useConfigForm({ defaults, fetcher, saver, successMessage, afterLoad }) {
  const toastStore = useToastStore()
  const saving = ref(false)
  const form = reactive(structuredClone(toRaw(defaults)))

  async function load() {
    try {
      const data = await fetcher()
      if (data) {
        Object.assign(form, data)
      }
      afterLoad?.(form)
    } catch (error) {
      console.error('[ConfigForm] 加载配置失败:', error)
    }
  }

  async function save() {
    saving.value = true
    try {
      const result = await saver(JSON.parse(JSON.stringify(form)))
      if (result.success) {
        toastStore.success(successMessage)
      } else {
        toastStore.error(result.message || '保存失败')
      }
      return result
    } finally {
      saving.value = false
    }
  }

  return { form, saving, load, save }
}
