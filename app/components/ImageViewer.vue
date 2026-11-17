<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="close"
      >
        <!-- 关闭按钮 -->
        <button
          class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10"
          @click="close"
        >
          <Icon name="heroicons:x-mark" class="w-8 h-8" />
        </button>

        <!-- 媒体内容 -->
        <div
          class="viewer-image max-w-[90vw] max-h-[90vh] transition-transform duration-300"
          @click.stop
        >
          <video
            v-if="mediaType === 'video'"
            :src="resolvedSrc"
            :poster="poster || ''"
            class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl bg-black"
            controls
            autoplay
          ></video>
          <img
            v-else
            :src="resolvedSrc"
            :alt="alt"
            class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="absolute top-4 left-4 flex gap-2 z-10" @click.stop>
          <button
            v-if="resolvedSrc || src"
            class="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors"
            title="复制链接"
            @click="copyLink"
          >
            <Icon name="heroicons:clipboard-document" class="w-4 h-4" />
            <span class="hidden sm:inline">复制链接</span>
          </button>
        </div>

        <!-- 图片信息 -->
        <div
          v-if="info"
          class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-sm"
          @click.stop
        >
          {{ info }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { copyToClipboard } from '~/utils/clipboard'
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  src: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: ''
  },
  info: {
    type: String,
    default: ''
  },
  mediaType: {
    type: String,
    default: 'image'
  },
  poster: {
    type: String,
    default: ''
  },
  // 可选：传入媒体对象。私有媒体需要带 Bearer 头加载（<img> 无法携带），
  // 传入后将通过 fetch + Blob URL 解析真实 src，忽略静态 src 属性
  media: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const mediaSrc = useMediaSrc(() => props.media || { url: props.src })
const resolvedSrc = computed(() => (props.media ? mediaSrc.src.value : props.src))

function copyLink() {
  const url = props.media?.url || props.src || ''
  if (!url) return
  const full = typeof window !== 'undefined' ? window.location.origin + url : url
  copyToClipboard(full).then(() => {
    // 轻量反馈：图标闪换为勾
    const btn = document.querySelector('[title="复制链接"]')
    if (btn) {
      const icon = btn.querySelector('.iconify, svg')
      if (icon) {
        const orig = icon.className
        icon.className = orig + ' text-green-400'
        setTimeout(() => { icon.className = orig }, 1000)
      }
    }
  }).catch(() => {})
}

const close = () => {
  emit('close')
}

// ESC 键关闭
onMounted(() => {
  const handleEsc = (e) => {
    if (e.key === 'Escape' && props.visible) {
      close()
    }
  }
  window.addEventListener('keydown', handleEsc)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleEsc)
  })
})
</script>
