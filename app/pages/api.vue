<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-8">API 管理</h1>

    <div class="flex border-b border-gray-200 dark:border-gray-700 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="activeTab === tab.id
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-show="activeTab === 'public'" class="space-y-6">
      <AdminMediaPolicyPanel />
    </div>

    <div v-show="activeTab === 'private'" class="space-y-6">
      <AdminPrivateUploadPanel />
      <AdminApiKeysPanel />
    </div>

    <div v-show="activeTab === 'users'" class="space-y-6">
      <AdminUsersPanel />
    </div>

    <div v-show="activeTab === 'docs'" class="space-y-4">
      <AdminApiDocsPanel />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

definePageMeta({
  middleware: 'auth',
  adminOnly: true
})

// 管理页薄壳：各 Tab 的表单/列表逻辑全部下沉到 app/components/admin/*Panel.vue
const tabs = [
  { id: 'public', label: '匿名与安全' },
  { id: 'private', label: '登录上传' },
  { id: 'users', label: '用户管理' },
  { id: 'docs', label: 'API文档' }
]
const activeTab = ref('public')
</script>
