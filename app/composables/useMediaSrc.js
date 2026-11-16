import { ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'

// 私有媒体（visibility=private 及需要鉴权的预览接口）无法通过 <img src> 加载——
// 标签请求携带不了 Authorization 头，会得到 403"加载失败"。
// 这里统一处理：公开媒体直接用直链；需要鉴权的媒体用 fetch + Blob URL，
// 并按 URL 做模块级缓存，避免画廊反复请求。
const blobUrlCache = new Map()

function resolveAuthUrl(url) {
  // 管理端违规预览接口同样需要鉴权
  return url
}

async function fetchAuthorizedBlobUrl(url, token) {
  if (blobUrlCache.has(url)) {
    return blobUrlCache.get(url)
  }

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  blobUrlCache.set(url, objectUrl)
  return objectUrl
}

// 判断媒体对象在 <img>/<video> 中是否需要带凭证加载
export function mediaRequiresAuth(media = {}) {
  if (!media) return false
  // 违规/删除态走 /api/images/preview 需要管理员凭证；
  // 私有直链 /i/... 需要 Bearer；仅公开可见性可直连
  return media.visibility === 'private' || !!(media.previewUrl)
}

export function useMediaSrc(getMedia) {
  const src = ref('')
  const error = ref(false)
  const loading = ref(true)

  async function refresh(media) {
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

    // 未登录却遇到需鉴权的媒体（例如首页上的私有项）：直接按原样尝试
    if (!authStore.isAuthenticated) {
      src.value = url
      loading.value = false
      return
    }

    loading.value = true
    error.value = false
    try {
      src.value = await fetchAuthorizedBlobUrl(resolveAuthUrl(url), authStore.token)
    } catch (e) {
      error.value = true
      src.value = ''
    } finally {
      loading.value = false
    }
  }

  watch(
    () => getMedia(),
    (media) => { refresh(media) },
    { immediate: true }
  )

  return { src, error, loading }
}
