<template>
  <div class="card p-5">
    <div class="flex items-center gap-3 mb-4">
      <div class="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
        <Icon name="heroicons:cloud-arrow-up" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
      </div>
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">上传 API</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400">支持匿名上传与 API Key 私有上传</p>
      </div>
    </div>

    <div class="space-y-2 mb-4">
      <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Icon name="heroicons:globe-alt" class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">POST</span>
            <code class="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">{{ baseUrl }}/api/upload/public</code>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">匿名上传 - 无需认证</p>
        </div>
      </div>
      <div class="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
        <Icon name="heroicons:lock-closed" class="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">POST</span>
            <code class="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">{{ baseUrl }}/api/upload/private</code>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">私有上传 - 需要 <code class="text-purple-600 dark:text-purple-400">X-API-Key</code> 请求头</p>
        </div>
      </div>
    </div>

    <div>
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">响应格式</h4>
      <div class="relative">
        <pre class="bg-gray-900 text-gray-100 rounded-lg p-3 text-sm overflow-x-auto"><code>{{ responseExample }}</code></pre>
        <button
          @click="copyResponse"
          class="absolute top-1.5 right-1.5 p-1.5 text-gray-400 hover:text-white transition-colors"
          title="复制代码"
        >
          <Icon name="heroicons:clipboard-document" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useToastStore } from '~/stores/toast'
import { copyToClipboard } from '~/utils/clipboard'

// API 文档面板（静态展示 + 复制）
const toastStore = useToastStore()

const baseUrl = computed(() => import.meta.client ? window.location.origin : '')

const responseExample = computed(() => `{
  "success": true,
  "data": {
    "id": "media-id",
    "uuid": "media-uuid",
    "url": "${baseUrl.value}/i/media-uuid.mp4",
    "fullUrl": "${baseUrl.value}/i/media-uuid.mp4",
    "filename": "media-uuid.mp4",
    "originalName": "demo.mp4",
    "format": "mp4",
    "mediaType": "video",
    "mimeType": "video/mp4",
    "visibility": "private",
    "ownerName": "demo-user",
    "size": 123456
  }
}`)

function copyResponse() {
  copyToClipboard(responseExample.value).then(() => {
    toastStore.success('代码已复制到剪贴板')
  }).catch(() => {
    toastStore.error('复制失败')
  })
}
</script>
