<template>
  <button
    type="button"
    :disabled="disabled"
    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
    :class="modelValue ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span
      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
      :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
    />
  </button>
</template>

<script setup>
// 统一开关组件（收敛历史上 12 份复制的 toggle 按钮组）
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])
</script>
