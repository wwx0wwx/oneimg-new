import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

export const useMediaStore = defineStore('media', {
  state: () => ({
    mediaItems: [],
    loading: false,
    uploading: false,
    currentUserRole: 'anonymous',
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    },
    hasMore: true,
    selectedIds: []
  }),

  actions: {
    async fetchMedia(reset = false) {
      if (this.loading) return

      if (reset) {
        this.pagination.page = 1
        this.mediaItems = []
        this.hasMore = true
        this.selectedIds = []
      }

      if (!this.hasMore) return
      this.loading = true

      try {
        const authStore = useAuthStore()
        const response = await $fetch('/api/images', {
          params: {
            page: this.pagination.page,
            limit: this.pagination.limit
          },
          headers: authStore.authHeader
        })

        if (response.success) {
          const items = response.data.media || []
          if (reset) {
            this.mediaItems = items
          } else {
            this.mediaItems.push(...items)
          }

          this.currentUserRole = response.data.currentUserRole || 'anonymous'
          this.pagination = response.data.pagination
          this.hasMore = this.pagination.page < this.pagination.totalPages
        }
      } catch (error) {
        console.error('获取媒体列表失败:', error)
      } finally {
        this.loading = false
      }
    },

    async loadMore() {
      if (!this.hasMore || this.loading) return
      this.pagination.page++
      await this.fetchMedia()
    },

    prependMedia(item) {
      this.mediaItems.unshift(item)
      this.pagination.total += 1
    },

    async deleteMedia(id) {
      const authStore = useAuthStore()

      try {
        const response = await $fetch(`/api/images/${id}`, {
          method: 'DELETE',
          headers: authStore.authHeader
        })

        if (response.success) {
          this.mediaItems = this.mediaItems.filter(item => item.id !== id)
          this.selectedIds = this.selectedIds.filter(selectedId => selectedId !== id)
          this.pagination.total = Math.max(0, this.pagination.total - 1)
          return { success: true }
        }

        return { success: false, message: response.message || '删除失败' }
      } catch (error) {
        return { success: false, message: error.data?.message || '删除失败，请稍后重试' }
      }
    },

    async batchDelete() {
      if (this.selectedIds.length === 0) return { success: false, message: '请选择要删除的媒体' }
      const authStore = useAuthStore()

      try {
        const response = await $fetch('/api/images/batch', {
          method: 'DELETE',
          body: { ids: this.selectedIds },
          headers: authStore.authHeader
        })

        if (response.success) {
          const deletedIds = new Set(this.selectedIds)
          this.mediaItems = this.mediaItems.filter(item => !deletedIds.has(item.id))
          this.pagination.total = Math.max(0, this.pagination.total - (response.data.deletedCount || 0))
          this.selectedIds = []
          return {
            success: true,
            message: response.message,
            data: response.data
          }
        }

        return { success: false, message: response.message || '删除失败' }
      } catch (error) {
        return { success: false, message: error.data?.message || '批量删除失败' }
      }
    },

    toggleSelect(id) {
      const index = this.selectedIds.indexOf(id)
      if (index > -1) this.selectedIds.splice(index, 1)
      else this.selectedIds.push(id)
    },

    clearSelection() {
      this.selectedIds = []
    },

    toggleSelectAll() {
      if (this.selectedIds.length === this.mediaItems.length) {
        this.selectedIds = []
      } else {
        this.selectedIds = this.mediaItems.map(item => item.id)
      }
    }
  },

  getters: {
    isAllSelected: (state) => state.mediaItems.length > 0 && state.selectedIds.length === state.mediaItems.length,
    hasSelection: (state) => state.selectedIds.length > 0,
    selectedItems: (state) => state.mediaItems.filter(item => state.selectedIds.includes(item.id))
  }
})
