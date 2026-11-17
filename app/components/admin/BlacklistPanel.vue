<template>
  <div class="card p-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">IP 黑名单</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">被拉黑的 IP 无法上传与导入（违规自动拉黑也会出现在此）</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <input v-model="newIp" type="text" class="input" placeholder="IP 地址（IPv4/IPv6）" @keyup.enter="add" />
      <input v-model="newReason" type="text" class="input" placeholder="原因（可选）" @keyup.enter="add" />
      <button class="btn-primary" :disabled="adding" @click="add">
        {{ adding ? '添加中...' : '添加' }}
      </button>
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-400">加载中...</div>
    <div v-else-if="error" class="py-8 text-center">
      <p class="text-red-500 mb-3">{{ error }}</p>
      <button class="btn-secondary" @click="load">重试</button>
    </div>
    <div v-else-if="records.length === 0" class="py-8 text-center text-gray-400">黑名单为空</div>

    <div v-else class="space-y-3">
      <div
        v-for="item in records"
        :key="item._id"
        class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
      >
        <div>
          <div class="font-medium text-gray-900 dark:text-white font-mono">{{ item.ip }}</div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ item.reason || '未注明原因' }} · {{ formatDateTime(item.createdAt) }}</p>
        </div>
        <button class="btn-danger text-sm" :disabled="removingId === item._id" @click="remove(item)">
          {{ removingId === item._id ? '移除中...' : '移除' }}
        </button>
      </div>

      <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-3 pt-2">
        <button class="btn-secondary text-sm" :disabled="pagination.page <= 1" @click="load(pagination.page - 1)">上一页</button>
        <span class="text-sm text-gray-500">{{ pagination.page }} / {{ pagination.totalPages }}</span>
        <button class="btn-secondary text-sm" :disabled="pagination.page >= pagination.totalPages" @click="load(pagination.page + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToastStore } from '~/stores/toast'
import { formatDateTime } from '~/utils/format'

// IP 黑名单管理（v2.2 拆分时 UI 意外丢失，本面板恢复管理入口）
const authStore = useAuthStore()
const toastStore = useToastStore()

const records = ref([])
const pagination = reactive({ page: 1, total: 0, totalPages: 0 })
const loading = ref(false)
const error = ref(null)
const newIp = ref('')
const newReason = ref('')
const adding = ref(false)
const removingId = ref('')


async function load(page = 1) {
  loading.value = true
  error.value = null
  try {
    const response = await $fetch('/api/blacklist', {
      params: { page, limit: 20 },
      headers: authStore.authHeader
    })
    if (response.success) {
      records.value = response.data.records
      Object.assign(pagination, response.data.pagination)
    }
  } catch (e) {
    error.value = e?.data?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function add() {
  if (!newIp.value.trim()) {
    toastStore.error('请输入 IP 地址')
    return
  }
  adding.value = true
  try {
    const response = await $fetch('/api/blacklist', {
      method: 'POST',
      headers: authStore.authHeader,
      body: { ip: newIp.value.trim(), reason: newReason.value.trim() || '手动添加' }
    })
    if (response.success) {
      toastStore.success(`IP ${newIp.value.trim()} 已加入黑名单`)
      newIp.value = ''
      newReason.value = ''
      await load(1)
    }
  } catch (e) {
    toastStore.error(e?.data?.message || '添加失败')
  } finally {
    adding.value = false
  }
}

async function remove(item) {
  removingId.value = item._id
  try {
    const response = await $fetch(`/api/blacklist/${item._id}`, {
      method: 'DELETE',
      headers: authStore.authHeader
    })
    if (response.success) {
      toastStore.success(`IP ${item.ip} 已移除`)
      await load(pagination.page)
    }
  } catch (e) {
    toastStore.error(e?.data?.message || '移除失败')
  } finally {
    removingId.value = ''
  }
}

onMounted(() => load())
</script>
