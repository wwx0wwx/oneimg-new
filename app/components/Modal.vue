<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        @click="close"
      >
        <div
          class="card w-full max-w-md p-6"
          @click.stop
        >
          <!-- 标题 -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ title }}
            </h3>
            <button
              @click="close"
              class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- 内容 -->
          <div class="mb-6">
            <slot></slot>
          </div>

          <!-- 按钮 -->
          <div v-if="showCancel || showConfirm" class="flex justify-end gap-3">
            <button
              v-if="showCancel"
              @click="close"
              class="btn-secondary"
            >
              {{ cancelText }}
            </button>
            <button
              v-if="showConfirm"
              @click="handleConfirm"
              :class="confirmClass"
              :disabled="confirmDisabled || confirming"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '提示'
  },
  showCancel: {
    type: Boolean,
    default: true
  },
  showConfirm: {
    type: Boolean,
    default: true
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  confirmType: {
    type: String,
    default: 'primary' // 'primary' | 'danger'
  },
  confirmDisabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])
const confirming = ref(false)

// 防双击双发：确认动作期间禁用按钮
// L1：Vue emit 同步发射——finally 立即复位 confirming 意味着守卫窗口为零
// （第二次点击时守卫早已放行）。改为关窗时复位：每次弹窗只许点一次确认。
// 删除等操作幂等所以此前无害，但这是正确语义。
function handleConfirm() {
  if (confirming.value) return
  confirming.value = true
  emit('confirm')
}

// 弹窗关闭时复位守卫（下次打开可再点）
// 注意：prop 名是 visible（BUG-1：此前误写 props.show，恒 undefined → 永不触发）
watch(() => props.visible, (visible) => {
  if (!visible) {
    confirming.value = false
  }
})

const confirmClass = computed(() => {
  const baseClass = props.confirmType === 'danger' ? 'btn-danger' : 'btn-primary'
  return props.confirmDisabled ? `${baseClass} opacity-50 cursor-not-allowed` : baseClass
})

const close = () => {
  emit('close')
}

const confirm = () => {
  emit('confirm')
}
</script>
