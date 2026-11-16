import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

const DEFAULT_MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'tiff', 'mp4', 'webm', 'mov']

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    appSettings: {
      appName: 'OneImg',
      appLogo: '',
      backgroundUrl: '',
      backgroundBlur: 0,
      siteUrl: '',
      appDescription: 'OneImg 是一个面向个人使用的媒体床，统一管理图片与视频。',
      deletedImagesCount: 0,
      announcement: {
        enabled: false,
        content: '',
        displayType: 'modal'
      }
    },
    publicApiConfig: {
      enabled: true,
      allowedFormats: DEFAULT_MEDIA_EXTENSIONS,
      maxFileSize: 10 * 1024 * 1024,
      enableCompression: false,
      compressionQuality: 80,
      convertToWebp: false,
      convertToPng: false,
      rateLimit: 10,
      allowConcurrent: false,
      contentSafety: {
        enabled: false,
        provider: 'elysiatools',
        autoBlacklistIp: false,
        providers: {}
      }
    },
    privateApiConfig: {
      maxFileSize: 100 * 1024 * 1024,
      enableCompression: false,
      compressionQuality: 80,
      convertToWebp: false,
      convertToPng: false,
      showOnHomepage: false
    },
    apiKeys: [],
    mediaConfig: {
      allowAnonymousUpload: false,
      allowedExtensions: DEFAULT_MEDIA_EXTENSIONS,
      anonymousMaxFileSize: 10 * 1024 * 1024,
      userMaxFileSize: 50 * 1024 * 1024,
      adminMaxFileSize: 100 * 1024 * 1024,
      defaultUserVisibility: 'private'
    },
    loading: false
  }),

  actions: {
    async fetchPublicAppSettings() {
      try {
        const response = await $fetch('/api/settings/public')

        if (response.success) {
          this.appSettings.appName = response.data.appName
          this.appSettings.appLogo = response.data.appLogo
          this.appSettings.backgroundUrl = response.data.backgroundUrl
          this.appSettings.backgroundBlur = response.data.backgroundBlur
          this.appSettings.announcement = response.data.announcement || {
            enabled: false,
            content: '',
            displayType: 'modal'
          }
        }
      } catch (error) {
        console.error('获取公共应用设置失败:', error)
      }
    },

    async fetchAppSettings() {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/settings', {
          headers: authStore.authHeader
        })

        if (response.success) {
          this.appSettings = response.data
        }
      } catch (error) {
        console.error('获取应用设置失败:', error)
      }
    },

    async saveAppSettings(settings) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/settings', {
          method: 'PUT',
          body: settings,
          headers: authStore.authHeader
        })

        if (response.success) {
          this.appSettings = { ...this.appSettings, ...response.data }
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '保存失败' }
      }
    },

    async updateAppSetting(partialSettings) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/settings', {
          method: 'PUT',
          body: partialSettings,
          headers: authStore.authHeader
        })

        if (response.success) {
          this.appSettings = { ...this.appSettings, ...response.data }
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '保存失败' }
      }
    },

    async fetchPublicApiConfig() {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/config/public', {
          headers: authStore.authHeader
        })

        if (response.success) {
          this.publicApiConfig = {
            ...this.publicApiConfig,
            ...response.data
          }
        }
      } catch (error) {
        console.error('获取公共 API 配置失败:', error)
      }
    },

    async savePublicApiConfig(config) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/config/public', {
          method: 'PUT',
          body: config,
          headers: authStore.authHeader
        })

        if (response.success) {
          this.publicApiConfig = response.data
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '保存失败' }
      }
    },

    async fetchPrivateApiConfig() {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/config/private', {
          headers: authStore.authHeader
        })

        if (response.success) {
          this.privateApiConfig = response.data
        }
      } catch (error) {
        console.error('获取私有 API 配置失败:', error)
      }
    },

    async savePrivateApiConfig(config) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/config/private', {
          method: 'PUT',
          body: config,
          headers: authStore.authHeader
        })

        if (response.success) {
          this.privateApiConfig = response.data
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '保存失败' }
      }
    },

    async fetchMediaConfig() {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/media/config', {
          headers: authStore.authHeader
        })

        if (response.success) {
          this.mediaConfig = response.data
        }
      } catch (error) {
        console.error('获取媒体配置失败:', error)
      }
    },

    async saveMediaConfig(config) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/media/config', {
          method: 'PUT',
          body: config,
          headers: authStore.authHeader
        })

        if (response.success) {
          this.mediaConfig = response.data
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '保存失败' }
      }
    },

    async fetchUsers() {
      const authStore = useAuthStore()
      try {
        const response = await $fetch('/api/users', {
          headers: authStore.authHeader
        })
        return response.success ? response.data : []
      } catch (error) {
        console.error('获取用户列表失败:', error)
        return []
      }
    },

    async createUser(payload) {
      const authStore = useAuthStore()
      try {
        const response = await $fetch('/api/users', {
          method: 'POST',
          body: payload,
          headers: authStore.authHeader
        })
        return response.success ? { success: true, data: response.data } : { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '创建失败' }
      }
    },

    async updateUser(id, payload) {
      const authStore = useAuthStore()
      try {
        const response = await $fetch(`/api/users/${id}`, {
          method: 'PUT',
          body: payload,
          headers: authStore.authHeader
        })
        return response.success ? { success: true, data: response.data } : { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '更新失败' }
      }
    },

    async fetchApiKeys() {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/apikeys', {
          headers: authStore.authHeader
        })

        if (response.success) {
          this.apiKeys = response.data
        }
      } catch (error) {
        console.error('获取 API Key 列表失败:', error)
      }
    },

    async createApiKey(payload) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/apikeys', {
          method: 'POST',
          body: payload,
          headers: authStore.authHeader
        })

        if (response.success) {
          this.apiKeys.push(response.data)
          return { success: true, data: response.data }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '创建失败' }
      }
    },

    async updateApiKey(id, data) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch(`/api/apikeys/${id}`, {
          method: 'PUT',
          body: data,
          headers: authStore.authHeader
        })

        if (response.success) {
          const index = this.apiKeys.findIndex(k => k.id === id)
          if (index > -1) {
            this.apiKeys[index] = response.data
          }
          return { success: true, data: response.data }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '更新失败' }
      }
    },

    async deleteApiKey(id) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch(`/api/apikeys/${id}`, {
          method: 'DELETE',
          headers: authStore.authHeader
        })

        if (response.success) {
          this.apiKeys = this.apiKeys.filter(k => k.id !== id)
          return { success: true }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '删除失败' }
      }
    },

    async hardDeleteImages() {
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/settings/hard-delete', {
          method: 'POST',
          headers: authStore.authHeader
        })

        if (response.success) {
          this.appSettings.deletedImagesCount = 0
          return { success: true, message: response.message, count: response.data.deletedCount }
        }

        return { success: false, message: response.message }
      } catch (error) {
        return { success: false, message: error.data?.message || '删除失败' }
      }
    }
  }
})
