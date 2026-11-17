import { ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

// 私有媒体（visibility=private 及需要鉴权的预览接口）无法通过 <img src> 加载——
// 标签请求携带不了 Authorization 头，会得到 403"加载失败"。
// 这里统一处理：公开媒体直接用直链；需要鉴权的媒体用 fetch + Blob URL。
const blobUrlCache = new Map() // key: `${userId}:${url}`, value: { objectUrl, lastUsed }
const BLOB_CACHE_MAX = 50      // LRU 上限：超出时回收最久未用（B3 内存泄漏）

function touchCacheEntry(url) {
  const entry = blobUrlCache.get(url)
  if (entry) {
    entry.lastUsed = Date.now()
    blobUrlCache.delete(url)
    blobUrlCache.set(url, entry)
  }
}

function evictIfNeeded() {
  while (blobUrlCache.size > BLOB_CACHE_MAX) {
    const oldestKey = blobUrlCache.keys().next().value
    const entry = blobUrlCache.get(oldestKey)
    blobUrlCache.delete(oldestKey)
    if (entry) URL.revokeObjectURL(entry.objectUrl)
  }
}

async function fetchAuthorizedBlobUrl(url, token, userId = '') {
  // 缓存 key 按用户区分（防止登出换号后命中前一账号的 blob——中危11）
  const cacheKey = `${userId}:${url}`
  const cached = blobUrlCache.get(cacheKey)
  if (cached) {
    touchCacheEntry(cacheKey)
    return cached.objectUrl
  }

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  blobUrlCache.set(cacheKey, { objectUrl, lastUsed: Date.now() })
  evictIfNeeded()
  return objectUrl
}

// 判断媒体对象在 <img>/<video> 中是否需要带凭证加载
export function mediaRequiresAuth(media = {}) {
  if (!media) return false
  return media.visibility === 'private' || !!(media.previewUrl)
}

export function useMediaSrc(getMedia) {
  const src = ref('')
  const error = ref(false)
  const loading = ref(true)
  // 竞态防护：快速切换媒体时，旧的异步结果不得覆盖新的（B4）
  let requestToken = 0

  async function refresh(media) {
    const token = ++requestToken
    const authStore = useAuthStore()
    const url = media?.previewUrl || media?.url || ''

    if (!url) {
      src.value = ''
      loading.value = false
      return
    }

    if (!mediaRequiresAuth(media)) {
      src.value = url
      loading.value = false
      return
    }

    // 未登录却遇到需鉴权的媒体：直接按原样尝试
    if (!authStore.isAuthenticated) {
      src.value = url
      loading.value = false
      return
    }

    loading.value = true
    error.value = false
    try {
      const objectUrl = await fetchAuthorizedBlobUrl(url, authStore.token, authStore.user?.id || 'anon')
      if (token !== requestToken) return // 已切换到其他媒体，丢弃过期结果
      src.value = objectUrl
    } catch (e) {
      if (token !== requestToken) return
      error.value = true
      src.value = ''
    } finally {
      if (token === requestToken) {
        loading.value = false
      }
    }
  }

  watch(
    () => getMedia(),
    (media) => { refresh(media) },
    { immediate: true }
  )

  return { src, error, loading }
}
