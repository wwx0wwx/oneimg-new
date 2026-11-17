<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <Announcement />

    <section class="mb-8">
      <UploadArea />
    </section>

    <div
      v-if="authStore.isAuthenticated && mediaStore.hasSelection"
      class="sticky top-20 z-30 mb-4 p-4 card flex items-center justify-between"
    >
      <div class="flex items-center gap-4">
        <button @click="mediaStore.toggleSelectAll" class="btn-secondary text-sm">
          {{ mediaStore.isAllSelected ? '取消全选' : '全选' }}
        </button>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          已选择 {{ mediaStore.selectedIds.length }} 个媒体项
        </span>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <button @click="openBatchLinksModal" class="btn-secondary text-sm">批量提取链接</button>
        <button @click="mediaStore.clearSelection" class="btn-secondary text-sm">取消选择</button>
        <button @click="showBatchDeleteModal = true" class="btn-danger text-sm">批量删除</button>
      </div>
    </div>

    <section>
      <div v-if="mediaStore.loading && mediaStore.mediaItems.length === 0" class="flex justify-center py-12">
        <Loading size="lg" />
      </div>

      <div v-else-if="mediaStore.error" class="text-center py-16">
        <Icon name="heroicons:wifi-slash" class="w-16 h-16 mx-auto text-red-300 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">加载失败</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">{{ mediaStore.error }}</p>
        <button class="btn-secondary" @click="mediaStore.retry()">重试</button>
      </div>

      <div v-else-if="mediaStore.mediaItems.length === 0" class="text-center py-16">
        <Icon name="heroicons:photo" class="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">欢迎来到 {{ settingsStore.appSettings.appName || 'OneImg' }}</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-1">这是一个个人媒体床：上传图片与视频，生成直链分享。</p>
        <p class="text-gray-400 dark:text-gray-500">上传你的第一个媒体项吧</p>
      </div>

      <div v-else class="masonry-container">
        <div v-for="(column, columnIndex) in mediaColumns" :key="columnIndex" class="masonry-column">
          <div v-for="media in column" :key="media.id" class="masonry-item">
            <ImageCard
              :image="media"
              :selected="mediaStore.selectedIds.includes(media.id)"
              :selectable="authStore.isAuthenticated"
              @click="openViewer(media)"
              @select="mediaStore.toggleSelect(media.id)"
              @delete="confirmDelete(media)"
              @contextmenu="handleMediaContextMenu"
            />
          </div>
        </div>
      </div>

      <div v-if="mediaStore.hasMore && mediaStore.mediaItems.length > 0" ref="loadMoreTrigger" class="flex justify-center py-8">
        <Loading v-if="mediaStore.loading" />
        <button v-else @click="mediaStore.loadMore" class="btn-secondary">加载更多</button>
      </div>
    </section>

    <ImageViewer
      :visible="viewerVisible"
      :src="viewerMedia?.url || ''"
      :media="viewerMedia"
      :alt="viewerMedia?.filename || ''"
      :info="viewerMediaInfo"
      :media-type="viewerMedia?.mediaType || 'image'"
      :poster="viewerMedia?.poster || viewerMedia?.coverUrl || ''"
      @close="closeViewer"
    />

    <Modal
      :visible="showDeleteModal"
      title="确认删除"
      confirm-text="删除"
      confirm-type="danger"
      @close="showDeleteModal = false"
      @confirm="handleDelete"
    >
      <p class="text-gray-600 dark:text-gray-400">确定要删除这个媒体项吗？删除后可在设置页面进行硬删除。</p>
    </Modal>

    <Modal
      :visible="showBatchDeleteModal"
      title="确认批量删除"
      confirm-text="删除"
      confirm-type="danger"
      @close="showBatchDeleteModal = false"
      @confirm="handleBatchDelete"
    >
      <p class="text-gray-600 dark:text-gray-400">确定要删除选中的 {{ mediaStore.selectedIds.length }} 个媒体项吗？</p>
    </Modal>

    <Modal
      :visible="showBatchLinksModal"
      title="批量提取链接"
      confirm-text="复制结果"
      @close="showBatchLinksModal = false"
      @confirm="copyBatchLinks"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">提取格式</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="item in copyOptions"
              :key="item.type"
              type="button"
              class="px-3 py-2 rounded-lg border text-sm transition-colors"
              :class="batchLinkType === item.type
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'"
              @click="batchLinkType = item.type"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">输出结果</label>
          <textarea :value="batchLinksText" rows="10" readonly class="input w-full font-mono text-sm"></textarea>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">共 {{ mediaStore.selectedItems.length }} 条，支持图片与视频统一提取。</p>
        </div>
      </div>
    </Modal>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="contextMenuVisible"
          ref="contextMenuRef"
          class="fixed z-50 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        >
          <div class="py-1">
            <div class="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">{{ copyMenuTitle }}</div>
            <button
              v-for="item in copyOptions"
              :key="item.type"
              @click="handleCopyFromMenu(item.type)"
              class="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Icon name="heroicons:clipboard-document" class="w-4 h-4 text-gray-400" />
              {{ item.label }}
            </button>
          </div>

          <div v-if="authStore.isAuthenticated" class="border-t border-gray-200 dark:border-gray-700"></div>

          <div v-if="authStore.isAuthenticated" class="py-1">
            <button @click="handleSetAsBackgroundFromMenu" class="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
              <Icon name="heroicons:photo" class="w-4 h-4 text-gray-400" />
              设为全局背景
            </button>
            <button @click="handleSetAsLogoFromMenu" class="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
              <Icon name="heroicons:sparkles" class="w-4 h-4 text-gray-400" />
              设为网站Logo
            </button>
          </div>

          <div v-if="authStore.isAuthenticated" class="border-t border-gray-200 dark:border-gray-700"></div>

          <div v-if="authStore.isAuthenticated" class="py-1">
            <button @click="handleDeleteFromMenu" class="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
              <Icon name="heroicons:trash" class="w-4 h-4" />
              删除媒体
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-4 scale-95"
    >
      <button
        v-show="showBackToTop"
        @click="scrollToTop"
        class="fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-label="返回顶部"
        title="返回顶部"
      >
        <Icon name="heroicons:arrow-up" class="w-6 h-6 flex-shrink-0" />
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useMediaStore } from '~/stores/media'
import { useSettingsStore } from '~/stores/settings'
import { useToastStore } from '~/stores/toast'
import { copyToClipboard } from '../utils/clipboard'
import { formatMediaLink } from '../../shared/mediaLinks.js'
import { formatFileSize } from '~/utils/format'

const authStore = useAuthStore()
const mediaStore = useMediaStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()

const columnCount = ref(2)
const viewerVisible = ref(false)
const viewerMedia = ref(null)
const showDeleteModal = ref(false)
const showBatchDeleteModal = ref(false)
const mediaToDelete = ref(null)
const showBackToTop = ref(false)
const scrollThreshold = 300
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuRef = ref(null)
const contextMenuMedia = ref(null)
const showBatchLinksModal = ref(false)
const batchLinkType = ref('direct')
const loadMoreTrigger = ref(null)
let observer = null

const copyOptions = [
  { type: 'direct', label: '原始直链' },
  { type: 'html', label: 'HTML' },
  { type: 'markdown', label: 'Markdown' },
  { type: 'bbcode', label: 'BBCode' }
]

function updateColumnCount() {
  const width = window.innerWidth
  if (width >= 1280) columnCount.value = 5
  else if (width >= 1024) columnCount.value = 4
  else if (width >= 640) columnCount.value = 3
  else columnCount.value = 2
}

const mediaColumns = computed(() => {
  const columns = Array.from({ length: columnCount.value }, () => [])
  mediaStore.mediaItems.forEach((media, index) => {
    columns[index % columnCount.value].push(media)
  })
  return columns
})

const viewerMediaInfo = computed(() => {
  if (!viewerMedia.value) return ''
  const { filename, width, height, size, mediaType } = viewerMedia.value
  const dimensionText = width && height ? `${width}×${height} · ` : ''
  const typeText = mediaType === 'video' ? '视频' : '图片'
  return `${filename} · ${typeText} · ${dimensionText}${formatFileSize(size)}`
})

// 链接格式化统一使用 shared/mediaLinks（与服务端单一实现，origin 注入站点前缀）
function formatLinkByType(type, item) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return formatMediaLink(item, type, origin)
}

const copyMenuTitle = computed(() => mediaStore.selectedIds.length > 1 ? `复制链接(已选${mediaStore.selectedIds.length}项)` : '复制链接')
const batchLinksText = computed(() => mediaStore.selectedItems.map(item => formatLinkByType(batchLinkType.value, item)).join('\n'))

function openBatchLinksModal() {
  if (!mediaStore.selectedItems.length) {
    toastStore.error('请先选择媒体')
    return
  }
  showBatchLinksModal.value = true
}

function copyBatchLinks() {
  if (!batchLinksText.value) {
    toastStore.error('没有可复制的链接')
    return
  }
  copyToClipboard(batchLinksText.value).then(() => {
    toastStore.success('批量链接已复制到剪贴板')
    showBatchLinksModal.value = false
  }).catch(() => {
    toastStore.error('复制失败')
  })
}

function handleScroll() {
  showBackToTop.value = window.scrollY > scrollThreshold
  hideContextMenu()
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openViewer(media) {
  viewerMedia.value = media
  viewerVisible.value = true
}

function closeViewer() {
  viewerVisible.value = false
  viewerMedia.value = null
}

function confirmDelete(media) {
  mediaToDelete.value = media
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!mediaToDelete.value) return
  const result = await mediaStore.deleteMedia(mediaToDelete.value.id)
  if (result.success) toastStore.success('删除成功')
  else toastStore.error(result.message)
  showDeleteModal.value = false
  mediaToDelete.value = null
}

async function handleBatchDelete() {
  const result = await mediaStore.batchDelete()
  if (result.success) toastStore.success(result.message)
  else toastStore.error(result.message)
  showBatchDeleteModal.value = false
}

function handleMediaContextMenu(event, media) {
  const menuWidth = 160
  const menuHeight = authStore.isAuthenticated ? 280 : 200
  let x = event.clientX
  let y = event.clientY
  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
  if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
  contextMenuX.value = x
  contextMenuY.value = y
  contextMenuMedia.value = media
  contextMenuVisible.value = true
}

function hideContextMenu() {
  contextMenuVisible.value = false
}

function handleClickOutside(event) {
  if (contextMenuRef.value && !contextMenuRef.value.contains(event.target)) hideContextMenu()
}

function handleCopyFromMenu(type) {
  if (mediaStore.selectedIds.length > 1) {
    const items = mediaStore.mediaItems.filter(item => mediaStore.selectedIds.includes(item.id))
    handleCopyMultiple(type, items)
  } else if (contextMenuMedia.value) {
    handleCopy(type, contextMenuMedia.value)
  }
  hideContextMenu()
}

function handleSetAsBackgroundFromMenu() {
  if (contextMenuMedia.value) handleSetAsBackground(window.location.origin + contextMenuMedia.value.url)
  hideContextMenu()
}

function handleSetAsLogoFromMenu() {
  if (contextMenuMedia.value) handleSetAsLogo(window.location.origin + contextMenuMedia.value.url)
  hideContextMenu()
}

function handleDeleteFromMenu() {
  if (contextMenuMedia.value) confirmDelete(contextMenuMedia.value)
  hideContextMenu()
}

function handleCopy(type, item) {
  copyToClipboard(formatLinkByType(type, item)).then(() => toastStore.success('已复制到剪贴板')).catch(() => toastStore.error('复制失败'))
}

async function handleCopyMultiple(type, items) {
  if (!items.length) {
    toastStore.error('没有可复制的媒体')
    return
  }

  try {
    const response = await $fetch('/api/media/links', {
      method: 'POST',
      headers: authStore.authHeader,
      body: { ids: items.map(item => item.id), format: type }
    })
    const output = response.data?.output || ''
    if (!output) {
      toastStore.error('没有可复制的链接')
      return
    }
    await copyToClipboard(output)
    const deniedCount = response.data?.deniedCount || 0
    toastStore.success(deniedCount > 0 ? `已复制 ${items.length - deniedCount} 个媒体链接，${deniedCount} 个因权限或状态不可用` : `已复制 ${items.length} 个媒体链接到剪贴板`)
  } catch (error) {
    toastStore.error(error.data?.message || '复制失败')
  }
}

async function handleSetAsBackground(url) {
  const result = await settingsStore.updateAppSetting({ backgroundUrl: url })
  if (result.success) toastStore.success('已设置为全局背景')
  else toastStore.error(result.message || '设置失败')
}

async function handleSetAsLogo(url) {
  const result = await settingsStore.updateAppSetting({ appLogo: url })
  if (result.success) toastStore.success('已设置为网站 Logo')
  else toastStore.error(result.message || '设置失败')
}

function setupIntersectionObserver() {
  if (observer) observer.disconnect()
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && mediaStore.hasMore && !mediaStore.loading) {
      mediaStore.loadMore()
    }
  }, { threshold: 0.1 })

  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value)
}

watch(() => mediaStore.mediaItems.length, () => nextTick(() => setupIntersectionObserver()))
watch(() => authStore.isAuthenticated, () => mediaStore.fetchMedia(true))

onMounted(async () => {
  updateColumnCount()
  window.addEventListener('resize', updateColumnCount)
  window.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('click', handleClickOutside)
  await mediaStore.fetchMedia(true)
  setupIntersectionObserver()
})

onUnmounted(() => {
  if (observer) observer.disconnect()
  window.removeEventListener('resize', updateColumnCount)
  window.removeEventListener('scroll', handleScroll)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.masonry-container {
  display: flex;
  gap: 16px;
}

.masonry-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.masonry-item {
  break-inside: avoid;
}
</style>
