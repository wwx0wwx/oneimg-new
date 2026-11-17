<template>
  <div class="card p-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">用户管理</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">管理员可创建、编辑、启停普通用户账户。</p>
      </div>
      <span class="text-xs px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">仅管理员可见</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <input v-model="userForm.username" type="text" class="input" placeholder="用户名" />
      <input v-model="userForm.password" type="password" class="input" placeholder="初始密码（至少 8 位）" />
      <button class="btn-primary" :disabled="creatingUser" @click="createUser">
        {{ creatingUser ? '创建中...' : '创建普通用户' }}
      </button>
    </div>

    <div class="space-y-3">
      <div
        v-for="user in users"
        :key="user.id"
        class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
      >
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-gray-900 dark:text-white">{{ user.username }}</span>
            <span class="px-2 py-0.5 rounded text-xs" :class="user.role === 'admin'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'">
              {{ user.role === 'admin' ? '管理员' : '普通用户' }}
            </span>
            <span class="px-2 py-0.5 rounded text-xs" :class="user.status === 'active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'">
              {{ user.status === 'active' ? '启用中' : '已禁用' }}
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">创建于 {{ formatDateTime(user.createdAt) }}</p>
        </div>
        <button
          class="btn-secondary text-sm"
          :disabled="(user.role === 'admin' && user.id === authStore.user?.id) || updatingUserId === user.id"
          @click="toggleUserStatus(user)"
        >
          {{ updatingUserId === user.id ? '处理中...' : (user.status === 'active' ? '禁用' : '启用') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useSettingsStore } from '~/stores/settings'
import { useToastStore } from '~/stores/toast'
import { formatDateTime } from '~/utils/format'

// 用户管理面板：创建普通用户、启停账户
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()

const users = ref([])
const creatingUser = ref(false)
const updatingUserId = ref('')
const userForm = reactive({ username: '', password: '' })

async function loadUsers() {
  users.value = await settingsStore.fetchUsers()
}

async function createUser() {
  if (!userForm.username.trim() || !userForm.password.trim()) {
    toastStore.error('请输入用户名和密码')
    return
  }

  creatingUser.value = true
  try {
    const result = await settingsStore.createUser({
      username: userForm.username.trim(),
      password: userForm.password.trim()
    })

    if (result.success) {
      toastStore.success('普通用户已创建')
      userForm.username = ''
      userForm.password = ''
      await loadUsers()
    } else {
      toastStore.error(result.message || '创建失败')
    }
  } finally {
    creatingUser.value = false
  }
}

async function toggleUserStatus(user) {
  updatingUserId.value = user.id
  try {
    const result = await settingsStore.updateUser(user.id, {
      status: user.status === 'active' ? 'disabled' : 'active'
    })
    if (result.success) {
      toastStore.success(`用户已${user.status === 'active' ? '禁用' : '启用'}`)
      await loadUsers()
    } else {
      toastStore.error(result.message || '更新失败')
    }
  } finally {
    updatingUserId.value = ''
  }
}

onMounted(loadUsers)
</script>
