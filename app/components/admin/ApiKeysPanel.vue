<template>
  <div class="card p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">API Key 管理</h2>
      <button @click="showAddKeyModal = true" class="btn-primary text-sm">添加 API Key</button>
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-400">加载中...</div>
        <div v-else-if="apiKeys.length === 0" class="py-8 text-center">
          <Icon name="heroicons:key" class="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p class="text-gray-400">暂无 API Key，点击上方按钮创建</p>
        </div>
        <div v-else class="space-y-3">
      <div
        v-for="key in apiKeys"
        :key="key.id"
        class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-white">{{ key.name }}</span>
            <span v-if="key.isDefault" class="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">默认</span>
            <span v-if="!key.enabled" class="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">已禁用</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <code class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{{ showKeyId === key.id ? key.key : maskKey(key.key) }}</code>
            <button @click="toggleShowKey(key.id)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <Icon v-if="showKeyId === key.id" name="heroicons:eye-slash" class="w-4 h-4" />
              <Icon v-else name="heroicons:eye" class="w-4 h-4" />
            </button>
            <button @click="copyApiKey(key.key)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="复制">
              <Icon name="heroicons:clipboard-document" class="w-4 h-4" />
            </button>
          </div>
          <div class="text-xs text-gray-400 mt-1 space-y-1">
            <div>归属用户：{{ key.ownerUsername || '未绑定' }}</div>
            <div>创建于 {{ formatDateTime(key.createdAt) }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-4">
          <button @click="regenerateKey(key)" class="btn-secondary text-sm" title="重新生成">刷新</button>
          <button v-if="!key.isDefault" @click="confirmDeleteKey(key)" class="btn-danger text-sm">删除</button>
        </div>
      </div>
    </div>

    <Modal
      :visible="showAddKeyModal"
      title="添加 API Key"
      @close="showAddKeyModal = false"
      @confirm="addApiKey"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">名称</label>
          <input v-model="newKeyName" type="text" class="input" placeholder="请输入 API Key 名称" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">归属用户</label>
          <select v-model="newKeyOwnerUserId" class="input w-full">
            <option value="" disabled>请选择归属用户</option>
            <option v-for="user in bindableUsers" :key="user.id" :value="user.id">{{ user.username }}</option>
          </select>
        </div>
      </div>
    </Modal>

    <Modal
      :visible="showDeleteKeyModal"
      title="确认删除"
      confirm-text="删除"
      confirm-type="danger"
      @close="showDeleteKeyModal = false"
      @confirm="deleteApiKey"
    >
      <p class="text-gray-600 dark:text-gray-400">确定要删除 API Key "{{ keyToDelete?.name }}" 吗？此操作不可恢复。</p>
    </Modal>

    <Modal
      :visible="showRegenerateKeyModal"
      title="确认刷新"
      confirm-text="刷新"
      confirm-type="danger"
      @close="showRegenerateKeyModal = false"
      @confirm="doRegenerateKey"
    >
      <p class="text-gray-600 dark:text-gray-400">确定要刷新 "{{ keyToRegenerate?.name }}" 吗？</p>
      <p class="text-red-500 dark:text-red-400 mt-2 font-medium">刷新后原来的 Key 将立即失效</p>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '~/stores/settings'
import { useToastStore } from '~/stores/toast'
import { formatDateTime } from '~/utils/format'
import { copyToClipboard } from '~/utils/clipboard'

// API Key 管理面板：列表 / 创建（绑定归属用户）/ 刷新 / 删除
const loading = ref(true)
const settingsStore = useSettingsStore()
const toastStore = useToastStore()

const showKeyId = ref(null)
const showAddKeyModal = ref(false)
const showDeleteKeyModal = ref(false)
const showRegenerateKeyModal = ref(false)
const newKeyName = ref('')
const newKeyOwnerUserId = ref('')
const keyToDelete = ref(null)
const keyToRegenerate = ref(null)
const users = ref([])

const apiKeys = computed(() => settingsStore.apiKeys)
const bindableUsers = computed(() => users.value.filter(user => user.status === 'active'))

function maskKey(key) {
  if (!key || key.length < 8) return key
  return key.slice(0, 4) + '****' + key.slice(-4)
}

function toggleShowKey(id) {
  showKeyId.value = showKeyId.value === id ? null : id
}

function copyApiKey(key) {
  copyToClipboard(key).then(() => {
    toastStore.success('API Key 已复制到剪贴板')
  }).catch(() => {
    toastStore.error('复制失败')
  })
}

async function addApiKey() {
  if (!newKeyName.value.trim()) {
    toastStore.error('请输入 API Key 名称')
    return
  }
  if (!newKeyOwnerUserId.value) {
    toastStore.error('请选择归属用户')
    return
  }

  const result = await settingsStore.createApiKey({
    name: newKeyName.value.trim(),
    ownerUserId: newKeyOwnerUserId.value
  })
  if (result.success) {
    toastStore.success('API Key 已创建')
    showAddKeyModal.value = false
    newKeyName.value = ''
    newKeyOwnerUserId.value = ''
  } else {
    toastStore.error(result.message || '创建失败')
  }
}

function regenerateKey(key) {
  keyToRegenerate.value = key
  showRegenerateKeyModal.value = true
}

async function doRegenerateKey() {
  if (!keyToRegenerate.value) return

  const result = await settingsStore.updateApiKey(keyToRegenerate.value.id, { regenerate: true })
  if (result.success) {
    toastStore.success('API Key 已更新，旧 Key 已失效')
  } else {
    toastStore.error(result.message || '更新失败')
  }

  showRegenerateKeyModal.value = false
  keyToRegenerate.value = null
}

function confirmDeleteKey(key) {
  keyToDelete.value = key
  showDeleteKeyModal.value = true
}

async function deleteApiKey() {
  if (!keyToDelete.value) return

  const result = await settingsStore.deleteApiKey(keyToDelete.value.id)
  if (result.success) {
    toastStore.success('API Key 已删除')
  } else {
    toastStore.error(result.message || '删除失败')
  }

  showDeleteKeyModal.value = false
  keyToDelete.value = null
}

onMounted(async () => {
  try {
    await settingsStore.fetchApiKeys()
    users.value = await settingsStore.fetchUsers()
    if (!newKeyOwnerUserId.value) {
      newKeyOwnerUserId.value = bindableUsers.value[0]?.id || ''
    }
  } finally {
    loading.value = false
  }
})
</script>
