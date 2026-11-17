<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-8">关于</h1>

    <div class="space-y-6">
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon name="heroicons:photo" class="w-5 h-5 text-primary-500" />
          OneImg
        </h2>
        <div class="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            OneImg 是一个面向个人使用的统一媒体床，围绕 media 模型统一管理图片与视频的上传、访问、预览、提链与权限控制。
          </p>
          <p>
            当前版本重点是稳定性、权限正确性和链路完整性：用户是资源拥有者，API Key 只是上传凭证，匿名上传、用户上传和管理员上传都会严格落到统一的数据语义与后端权限控制上。
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p class="font-medium text-gray-900 dark:text-white">媒体能力</p>
              <p class="mt-1">统一支持图片、视频上传、展示、预览与链接提取。</p>
            </div>
            <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p class="font-medium text-gray-900 dark:text-white">权限体系</p>
              <p class="mt-1">支持匿名访客、普通用户与管理员三级身份控制。</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon name="heroicons:rocket-launch" class="w-5 h-5 text-primary-500" />
          项目说明
        </h2>
        <div class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>OneImg 使用 Nuxt、`Nitro Server API`、`Pinia` 与 NeDB 构建，适合个人与轻量团队自部署。</p>
          <p>当前版本支持图片与视频的统一媒体墙展示、批量删除、批量提链、匿名上传控制、登录上传、API Key 上传和后台用户管理。</p>
          <p>内容安全能力目前主要针对图片内容，视频仅提供基础上传、预览、访问与播放能力，不包含额外转码流程。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  title: '关于'
})
</script>
