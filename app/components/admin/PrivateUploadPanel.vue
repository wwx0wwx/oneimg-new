<template>
  <div class="card p-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">登录上传配置 <span class="text-sm font-normal text-gray-500 dark:text-gray-400">- 登录用户与 API Key 使用</span></h2>

    <form @submit.prevent="form.save" class="space-y-4">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">开启压缩</label>
            <p class="text-xs text-gray-500 dark:text-gray-400">压缩上传的图片（默认不转换格式）</p>
          </div>
          <button
            type="button"
            @click="form.form.enableCompression = !form.form.enableCompression"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            :class="form.form.enableCompression ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
          >
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="form.form.enableCompression ? 'translate-x-6' : 'translate-x-1'" />
          </button>
        </div>

        <div v-if="form.form.enableCompression" class="ml-4 space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">压缩质量 ({{ form.form.compressionQuality }}%)</label>
            <input
              type="range"
              v-model.number="form.form.compressionQuality"
              min="10"
              max="100"
              step="5"
              class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">转换格式（二选一，可都不选）</label>
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">转为 WebP</label>
                <p class="text-xs text-gray-500 dark:text-gray-400">将图片转换为 WebP 格式（不可与转为 PNG 同时开启）</p>
              </div>
              <button
                type="button"
                @click="toggleConvertFormat('webp')"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="form.form.convertToWebp ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
              >
                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="form.form.convertToWebp ? 'translate-x-6' : 'translate-x-1'" />
              </button>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">转为 PNG</label>
                <p class="text-xs text-gray-500 dark:text-gray-400">将图片转换为 PNG 格式（不可与转为 WebP 同时开启）</p>
              </div>
              <button
                type="button"
                @click="toggleConvertFormat('png')"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="form.form.convertToPng ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
              >
                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="form.form.convertToPng ? 'translate-x-6' : 'translate-x-1'" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-4">
        <button type="submit" class="btn-primary" :disabled="form.saving.value">
          {{ form.saving.value ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from '~/stores/settings'

// 「登录上传」配置面板（privateApiConfig）
const settingsStore = useSettingsStore()

const form = useConfigForm({
  defaults: {
    // maxFileSize/showOnHomepage 为已移除的死字段（实际限额在媒体策略中配置）
    enableCompression: false,
    compressionQuality: 80,
    convertToWebp: false,
    convertToPng: false
  },
  fetcher: async () => (await settingsStore.fetchPrivateApiConfig(), settingsStore.privateApiConfig),
  saver: (data) => settingsStore.savePrivateApiConfig(data),
  successMessage: '登录上传配置已保存'
})

function toggleConvertFormat(format) {
  if (format === 'webp') {
    form.form.convertToWebp = !form.form.convertToWebp
    if (form.form.convertToWebp) form.form.convertToPng = false
  } else if (format === 'png') {
    form.form.convertToPng = !form.form.convertToPng
    if (form.form.convertToPng) form.form.convertToWebp = false
  }
}

onMounted(() => form.load())
</script>
