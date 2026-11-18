<template>
  <div class="card p-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">匿名上传配置 <span class="text-sm font-normal text-gray-500 dark:text-gray-400">- 匿名上传行为与内容安全</span></h2>

    <form @submit.prevent="behavior.save" class="space-y-4">
      <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">允许匿名公开上传</label>
            <p class="text-xs text-gray-500 dark:text-gray-400">关闭后，未登录用户会被前后端同时拒绝上传。</p>
          </div>
          <ToggleSwitch v-model="policy.form.allowAnonymousUpload" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">允许上传的媒体扩展名</label>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="format in availableFormats"
              :key="format"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
              :class="policy.form.allowedExtensions.includes(format)
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'"
            >
              <input
                type="checkbox"
                :value="format"
                v-model="policy.form.allowedExtensions"
                class="sr-only"
              />
              <span class="text-sm uppercase">{{ format }}</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">匿名用户大小上限 (MB)</label>
            <input type="number" v-model.number="anonymousMaxSizeMB" min="1" max="500" class="input" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">普通用户大小上限 (MB)</label>
            <input type="number" v-model.number="userMaxSizeMB" min="1" max="500" class="input" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">管理员大小上限 (MB)</label>
            <input type="number" v-model.number="adminMaxSizeMB" min="1" max="1024" class="input" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">登录用户默认可见性</label>
          <select v-model="policy.form.defaultUserVisibility" class="input w-full max-w-xs">
            <option value="private">默认私有</option>
            <option value="public">默认公开</option>
          </select>
        </div>

        <p class="text-xs text-orange-600 dark:text-orange-400">
          ⚠️ 隐私提示：内容安全检测开启后，上传的图片会被发送到所配置的第三方检测服务（如 nsfwdet.com / elysiatools.com）。
          涉及隐私的部署请关闭该功能或改用自建检测服务（nsfw_detector）。
        </p>

        <div>
          <button type="button" class="btn-primary" :disabled="policy.saving.value" @click="policy.save">
            {{ policy.saving.value ? '保存中...' : '保存媒体策略' }}
          </button>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">开启压缩</label>
            <p class="text-xs text-gray-500 dark:text-gray-400">压缩上传的图片（默认不转换格式）</p>
          </div>
          <ToggleSwitch v-model="behavior.form.enableCompression" />
        </div>

        <div v-if="behavior.form.enableCompression" class="ml-4 space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">压缩质量 ({{ behavior.form.compressionQuality }}%)</label>
            <input
              type="range"
              v-model.number="behavior.form.compressionQuality"
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
              <ToggleSwitch :model-value="behavior.form.convertToWebp" @update:model-value="toggleConvertFormat('webp')" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">转为 PNG</label>
                <p class="text-xs text-gray-500 dark:text-gray-400">将图片转换为 PNG 格式（不可与转为 WebP 同时开启）</p>
              </div>
              <ToggleSwitch :model-value="behavior.form.convertToPng" @update:model-value="toggleConvertFormat('png')" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">请求频率限制 (同一 IP 每分钟请求数)</label>
        <input type="number" v-model.number="behavior.form.rateLimit" min="1" max="1000" class="input w-32" />
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">允许并发上传</label>
          <p class="text-xs text-gray-500 dark:text-gray-400">关闭后同一 IP 只能串行上传</p>
        </div>
        <ToggleSwitch v-model="behavior.form.allowConcurrent" />
      </div>

      <div class="pt-4">
        <button type="submit" class="btn-primary" :disabled="behavior.saving.value">
          {{ behavior.saving.value ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useSettingsStore } from '~/stores/settings'

// 「匿名与安全」面板：媒体策略（mediaConfig）+ 匿名上传行为（publicApiConfig）
const settingsStore = useSettingsStore()

import { MEDIA_FORMATS } from '../../../shared/mediaFormats.js'
const availableFormats = [...MEDIA_FORMATS]

// 内容安全默认值（密钥一律来自服务端环境变量，前端不持有）
const defaultContentSafetyConfig = {
  enabled: false,
  provider: 'elysiatools',
  autoBlacklistIp: false,
  providers: {
    nsfwdet: {
      name: 'NSFW Detector',
      apiUrl: 'https://nsfwdet.com/api/v1/detect-nsfw',
      apiKey: '',
      threshold: 0.5
    },
    elysiatools: {
      name: 'Elysia Tools',
      apiUrl: 'https://elysiatools.com/zh/api/tools/nsfw-image-detector'
    },
    nsfw_detector: {
      name: 'nsfw_detector',
      apiUrl: '',
      apiKey: '',
      threshold: 0.8
    }
  }
}

const policy = useConfigForm({
  defaults: {
    allowAnonymousUpload: false,
    allowedExtensions: [...availableFormats],
    anonymousMaxFileSize: 10 * 1024 * 1024,
    userMaxFileSize: 50 * 1024 * 1024,
    adminMaxFileSize: 100 * 1024 * 1024,
    defaultUserVisibility: 'private'
  },
  fetcher: async () => (await settingsStore.fetchMediaConfig(), settingsStore.mediaConfig),
  saver: (form) => settingsStore.saveMediaConfig(form),
  successMessage: '媒体策略已保存',
  afterLoad: (form) => {
    if (!Array.isArray(form.allowedExtensions) || form.allowedExtensions.length === 0) {
      form.allowedExtensions = [...availableFormats]
    }
  }
})

const behavior = useConfigForm({
  defaults: {
    enableCompression: false,
    compressionQuality: 80,
    convertToWebp: false,
    convertToPng: false,
    rateLimit: 10,
    allowConcurrent: false,
    contentSafety: structuredClone(defaultContentSafetyConfig)
  },
  fetcher: async () => {
    await settingsStore.fetchPublicApiConfig()
    const merged = { ...settingsStore.publicApiConfig }
    if (!merged.contentSafety) {
      merged.contentSafety = structuredClone(defaultContentSafetyConfig)
    }
    return merged
  },
  saver: (form) => settingsStore.savePublicApiConfig(form),
  successMessage: '公共上传配置已保存'
})


const anonymousMaxSizeMB = computed({
  get: () => Math.round(policy.form.anonymousMaxFileSize / (1024 * 1024)),
  set: (val) => { policy.form.anonymousMaxFileSize = val * 1024 * 1024 }
})
const userMaxSizeMB = computed({
  get: () => Math.round(policy.form.userMaxFileSize / (1024 * 1024)),
  set: (val) => { policy.form.userMaxFileSize = val * 1024 * 1024 }
})
const adminMaxSizeMB = computed({
  get: () => Math.round(policy.form.adminMaxFileSize / (1024 * 1024)),
  set: (val) => { policy.form.adminMaxFileSize = val * 1024 * 1024 }
})

// 转换格式开关（匿名上传配置与登录上传配置共享同一 composable——N1：此前漏接此组件）
const { toggleConvertFormat } = useConvertToggle(behavior.form)

onMounted(() => {
  policy.load()
  behavior.load()
})
</script>
