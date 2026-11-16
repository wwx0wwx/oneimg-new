<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-8">API 管理</h1>

    <div class="flex border-b border-gray-200 dark:border-gray-700 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="activeTab === tab.id
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-show="activeTab === 'public'" class="space-y-6">
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">匿名上传配置 <span class="text-sm font-normal text-gray-500 dark:text-gray-400">- 匿名上传行为与内容安全</span></h2>

        <form @submit.prevent="savePublicConfig" class="space-y-4">
          <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">允许匿名公开上传</label>
                <p class="text-xs text-gray-500 dark:text-gray-400">关闭后，未登录用户会被前后端同时拒绝上传。</p>
              </div>
              <button
                type="button"
                @click="mediaConfig.allowAnonymousUpload = !mediaConfig.allowAnonymousUpload"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="mediaConfig.allowAnonymousUpload ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  :class="mediaConfig.allowAnonymousUpload ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">允许上传的媒体扩展名</label>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="format in availableFormats"
                  :key="format"
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                  :class="mediaConfig.allowedExtensions.includes(format)
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'"
                >
                  <input
                    type="checkbox"
                    :value="format"
                    v-model="mediaConfig.allowedExtensions"
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
              <select v-model="mediaConfig.defaultUserVisibility" class="input w-full max-w-xs">
                <option value="private">默认私有</option>
                <option value="public">默认公开</option>
              </select>
            </div>

            <p class="text-xs text-orange-600 dark:text-orange-400">
              ⚠️ 隐私提示：内容安全检测开启后，上传的图片会被发送到所配置的第三方检测服务（如 nsfwdet.com / elysiatools.com）。
              涉及隐私的部署请关闭该功能或改用自建检测服务（nsfw_detector）。
            </p>

            <div>
              <button type="button" class="btn-primary" :disabled="saving" @click="saveMediaPolicy">
                {{ saving ? '保存中...' : '保存媒体策略' }}
              </button>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">开启压缩</label>
                <p class="text-xs text-gray-500 dark:text-gray-400">压缩上传的图片（默认不转换格式）</p>
              </div>
              <button
                type="button"
                @click="publicConfig.enableCompression = !publicConfig.enableCompression"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="publicConfig.enableCompression ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  :class="publicConfig.enableCompression ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>

            <div v-if="publicConfig.enableCompression" class="ml-4 space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">压缩质量 ({{ publicConfig.compressionQuality }}%)</label>
                <input
                  type="range"
                  v-model.number="publicConfig.compressionQuality"
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
                  <button
                    type="button"
                    @click="togglePublicConvertFormat('webp')"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    :class="publicConfig.convertToWebp ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                      :class="publicConfig.convertToWebp ? 'translate-x-6' : 'translate-x-1'"
                    />
                  </button>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">转为 PNG</label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">将图片转换为 PNG 格式（不可与转为 WebP 同时开启）</p>
                  </div>
                  <button
                    type="button"
                    @click="togglePublicConvertFormat('png')"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    :class="publicConfig.convertToPng ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                      :class="publicConfig.convertToPng ? 'translate-x-6' : 'translate-x-1'"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">请求频率限制 (同一 IP 每分钟请求数)</label>
            <input type="number" v-model.number="publicConfig.rateLimit" min="1" max="1000" class="input w-32" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">允许并发上传</label>
              <p class="text-xs text-gray-500 dark:text-gray-400">关闭后同一 IP 只能串行上传</p>
            </div>
            <button
              type="button"
              @click="publicConfig.allowConcurrent = !publicConfig.allowConcurrent"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="publicConfig.allowConcurrent ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
            >
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="publicConfig.allowConcurrent ? 'translate-x-6' : 'translate-x-1'" />
            </button>
          </div>

          <div class="pt-4">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? '保存中...' : '保存配置' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-show="activeTab === 'private'" class="space-y-6">
      <div class="card p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">登录上传配置 <span class="text-sm font-normal text-gray-500 dark:text-gray-400">- 登录用户与 API Key 使用</span></h2>

        <form @submit.prevent="savePrivateConfig" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">最大文件大小 (MB)</label>
            <input type="number" v-model.number="privateConfigMaxSizeMB" min="1" max="500" class="input w-32" />
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">开启压缩</label>
                <p class="text-xs text-gray-500 dark:text-gray-400">压缩上传的图片（默认不转换格式）</p>
              </div>
              <button
                type="button"
                @click="privateConfig.enableCompression = !privateConfig.enableCompression"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="privateConfig.enableCompression ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
              >
                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="privateConfig.enableCompression ? 'translate-x-6' : 'translate-x-1'" />
              </button>
            </div>

            <div v-if="privateConfig.enableCompression" class="ml-4 space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">压缩质量 ({{ privateConfig.compressionQuality }}%)</label>
                <input
                  type="range"
                  v-model.number="privateConfig.compressionQuality"
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
                  <button
                    type="button"
                    @click="togglePrivateConvertFormat('webp')"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    :class="privateConfig.convertToWebp ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="privateConfig.convertToWebp ? 'translate-x-6' : 'translate-x-1'" />
                  </button>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">转为 PNG</label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">将图片转换为 PNG 格式（不可与转为 WebP 同时开启）</p>
                  </div>
                  <button
                    type="button"
                    @click="togglePrivateConvertFormat('png')"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    :class="privateConfig.convertToPng ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
                  >
                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="privateConfig.convertToPng ? 'translate-x-6' : 'translate-x-1'" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">首页展示</label>
              <p class="text-xs text-gray-500 dark:text-gray-400">是否在首页展示私有上传的媒体</p>
            </div>
            <button
              type="button"
              @click="privateConfig.showOnHomepage = !privateConfig.showOnHomepage"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="privateConfig.showOnHomepage ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
            >
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="privateConfig.showOnHomepage ? 'translate-x-6' : 'translate-x-1'" />
            </button>
          </div>

          <div class="pt-4">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? '保存中...' : '保存配置' }}
            </button>
          </div>
        </form>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">API Key 管理</h2>
          <button @click="showAddKeyModal = true" class="btn-primary text-sm">添加 API Key</button>
        </div>

        <div class="space-y-3">
          <div
            v-for="key in apiKeys"
            :key="key.id"
            class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900 dark:text-white">{{ key.name }}</span>
                <span v-if="key.isDefault" class="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">默认</span>
                <span v-if="!key.enabled" class="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">已禁用</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <code class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{{ showKeyId === key.id ? key.key : maskKey(key.key) }}</code>
                <button @click="toggleShowKey(key.id)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <Icon v-if="showKeyId === key.id" name="heroicons:eye-slash" class="w-4 h-4" />
                  <Icon v-else name="heroicons:eye" class="w-4 h-4" />
                </button>
                <button @click="copyApiKey(key.key)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="复制">
                  <Icon name="heroicons:clipboard-document" class="w-4 h-4" />
                </button>
              </div>
              <div class="text-xs text-gray-400 mt-1 space-y-1">
                <div>归属用户：{{ key.ownerUsername || '未绑定' }}</div>
                <div>创建于 {{ formatDate(key.createdAt) }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <button @click="regenerateKey(key)" class="btn-secondary text-sm" title="重新生成">刷新</button>
              <button v-if="!key.isDefault" @click="confirmDeleteKey(key)" class="btn-danger text-sm">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="activeTab === 'users'" class="space-y-6">
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">用户管理</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">管理员可创建、编辑、启停普通用户账户。</p>
          </div>
          <span class="text-xs px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">仅管理员可见</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <input v-model="userForm.username" type="text" class="input" placeholder="用户名" />
          <input v-model="userForm.password" type="password" class="input" placeholder="初始密码（至少 8 位）" />
          <button class="btn-primary" :disabled="creatingUser" @click="createUser">
            {{ creatingUser ? '创建中...' : '创建普通用户' }}
          </button>
        </div>

        <div class="space-y-3">
          <div
            v-for="user in users"
            :key="user.id"
            class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-gray-900 dark:text-white">{{ user.username }}</span>
                <span class="px-2 py-0.5 rounded text-xs" :class="user.role === 'admin'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'">
                  {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                </span>
                <span class="px-2 py-0.5 rounded text-xs" :class="user.status === 'active'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'">
                  {{ user.status === 'active' ? '启用中' : '已禁用' }}
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">创建于 {{ formatDate(user.createdAt) }}</p>
            </div>
            <button
              class="btn-secondary text-sm"
              :disabled="(user.role === 'admin' && user.id === authStore.user?.id) || updatingUserId === user.id"
              @click="toggleUserStatus(user)"
            >
              {{ updatingUserId === user.id ? '处理中...' : (user.status === 'active' ? '禁用' : '启用') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-show="activeTab === 'docs'" class="space-y-4">
      <div class="card p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Icon name="heroicons:cloud-arrow-up" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">上传 API</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">支持匿名上传与 API Key 私有上传</p>
          </div>
        </div>

        <div class="space-y-2 mb-4">
          <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Icon name="heroicons:globe-alt" class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">POST</span>
                <code class="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">{{ baseUrl }}/api/upload/public</code>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">匿名上传 - 无需认证</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Icon name="heroicons:lock-closed" class="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">POST</span>
                <code class="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">{{ baseUrl }}/api/upload/private</code>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">私有上传 - 需要 <code class="text-purple-600 dark:text-purple-400">X-API-Key</code> 请求头</p>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">响应格式</h4>
          <div class="relative">
            <pre class="bg-gray-900 text-gray-100 rounded-lg p-3 text-sm overflow-x-auto"><code>{
  "success": true,
  "data": {
    "id": "media-id",
    "uuid": "media-uuid",
    "url": "{{ baseUrl }}/i/media-uuid.mp4",
    "fullUrl": "{{ baseUrl }}/i/media-uuid.mp4",
    "filename": "media-uuid.mp4",
    "originalName": "demo.mp4",
    "format": "mp4",
    "mediaType": "video",
    "mimeType": "video/mp4",
    "visibility": "private",
    "ownerName": "demo-user",
    "size": 123456
  }
}</code></pre>
            <button
              @click="copyCode('response')"
              class="absolute top-1.5 right-1.5 p-1.5 text-gray-400 hover:text-white transition-colors"
              title="复制代码"
            >
              <Icon name="heroicons:clipboard-document" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <Modal
      :visible="showAddKeyModal"
      title="添加 API Key"
      @close="showAddKeyModal = false"
      @confirm="addApiKey"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">名称</label>
          <input v-model="newKeyName" type="text" class="input" placeholder="请输入 API Key 名称" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">归属用户</label>
          <select v-model="newKeyOwnerUserId" class="input w-full">
            <option value="" disabled>请选择归属用户</option>
            <option v-for="user in bindableUsers" :key="user.id" :value="user.id">{{ user.username }}</option>
          </select>
        </div>
      </div>
    </Modal>

    <Modal
      :visible="showDeleteKeyModal"
      title="确认删除"
      confirm-text="删除"
      confirm-type="danger"
      @close="showDeleteKeyModal = false"
      @confirm="deleteApiKey"
    >
      <p class="text-gray-600 dark:text-gray-400">确定要删除 API Key "{{ keyToDelete?.name }}" 吗？此操作不可恢复。</p>
    </Modal>

    <Modal
      :visible="showRegenerateKeyModal"
      title="确认刷新"
      confirm-text="刷新"
      confirm-type="danger"
      @close="showRegenerateKeyModal = false"
      @confirm="doRegenerateKey"
    >
      <p class="text-gray-600 dark:text-gray-400">确定要刷新 "{{ keyToRegenerate?.name }}" 吗？</p>
      <p class="text-red-500 dark:text-red-400 mt-2 font-medium">刷新后原来的 Key 将立即失效</p>
    </Modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useSettingsStore } from '~/stores/settings'
import { useToastStore } from '~/stores/toast'
import { copyToClipboard } from '../utils/clipboard'

definePageMeta({
  middleware: 'auth',
  adminOnly: true
})

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()

const tabs = [
  { id: 'public', label: '匿名与安全' },
  { id: 'private', label: '登录上传' },
  { id: 'users', label: '用户管理' },
  { id: 'docs', label: 'API文档' }
]
const activeTab = ref('public')
const availableFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'tiff', 'mp4', 'webm', 'mov']

const baseUrl = computed(() => import.meta.client ? window.location.origin : '')
const saving = ref(false)
const showKeyId = ref(null)
const showAddKeyModal = ref(false)
const showDeleteKeyModal = ref(false)
const showRegenerateKeyModal = ref(false)
const newKeyName = ref('')
const newKeyOwnerUserId = ref('')
const keyToDelete = ref(null)
const keyToRegenerate = ref(null)

const users = ref([])
const creatingUser = ref(false)
const updatingUserId = ref('')
const userForm = reactive({
  username: '',
  password: ''
})

const defaultContentSafetyConfig = {
  enabled: false,
  provider: 'elysiatools',
  autoBlacklistIp: false,
  providers: {
    nsfwdet: {
      name: 'NSFW Detector',
      apiUrl: 'https://nsfwdet.com/api/v1/detect-nsfw',
      // API Key 一律由服务端 NSFWDET_API_KEY 环境变量提供，
      // 前端不持有、不提交任何密钥（历史硬编码 key 已删除并应吊销）
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

const publicConfig = reactive({
  enableCompression: false,
  compressionQuality: 80,
  convertToWebp: false,
  convertToPng: false,
  rateLimit: 10,
  allowConcurrent: false,
  contentSafety: structuredClone(defaultContentSafetyConfig)
})

const privateConfig = reactive({
  maxFileSize: 100 * 1024 * 1024,
  enableCompression: false,
  compressionQuality: 80,
  convertToWebp: false,
  convertToPng: false,
  showOnHomepage: false
})

const mediaConfig = reactive({
  allowAnonymousUpload: false,
  allowedExtensions: [...availableFormats],
  anonymousMaxFileSize: 10 * 1024 * 1024,
  userMaxFileSize: 50 * 1024 * 1024,
  adminMaxFileSize: 100 * 1024 * 1024,
  defaultUserVisibility: 'private'
})

const apiKeys = computed(() => settingsStore.apiKeys)
const bindableUsers = computed(() => users.value.filter(user => user.status === 'active'))

const privateConfigMaxSizeMB = computed({
  get: () => Math.round(privateConfig.maxFileSize / (1024 * 1024)),
  set: (val) => { privateConfig.maxFileSize = val * 1024 * 1024 }
})
const anonymousMaxSizeMB = computed({
  get: () => Math.round(mediaConfig.anonymousMaxFileSize / (1024 * 1024)),
  set: (val) => { mediaConfig.anonymousMaxFileSize = val * 1024 * 1024 }
})
const userMaxSizeMB = computed({
  get: () => Math.round(mediaConfig.userMaxFileSize / (1024 * 1024)),
  set: (val) => { mediaConfig.userMaxFileSize = val * 1024 * 1024 }
})
const adminMaxSizeMB = computed({
  get: () => Math.round(mediaConfig.adminMaxFileSize / (1024 * 1024)),
  set: (val) => { mediaConfig.adminMaxFileSize = val * 1024 * 1024 }
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function maskKey(key) {
  if (!key || key.length < 8) return key
  return key.slice(0, 4) + '****' + key.slice(-4)
}

function toggleShowKey(id) {
  showKeyId.value = showKeyId.value === id ? null : id
}

function copyApiKey(key) {
  copyToClipboard(key).then(() => {
    toastStore.success('API Key 已复制到剪贴板')
  }).catch(() => {
    toastStore.error('复制失败')
  })
}

function copyCode(type) {
  let code = ''
  switch (type) {
    case 'response':
      code = `{
  "success": true,
  "data": {
    "id": "media-id",
    "uuid": "media-uuid",
    "url": "${baseUrl.value}/i/media-uuid.mp4",
    "fullUrl": "${baseUrl.value}/i/media-uuid.mp4",
    "filename": "media-uuid.mp4",
    "originalName": "demo.mp4",
    "format": "mp4",
    "mediaType": "video",
    "mimeType": "video/mp4",
    "visibility": "private",
    "ownerName": "demo-user",
    "size": 123456
  }
}`
      break
    default:
      code = `${baseUrl.value}/api/upload/public`
  }

  copyToClipboard(code).then(() => {
    toastStore.success('代码已复制到剪贴板')
  }).catch(() => {
    toastStore.error('复制失败')
  })
}

function togglePublicConvertFormat(format) {
  if (format === 'webp') {
    publicConfig.convertToWebp = !publicConfig.convertToWebp
    if (publicConfig.convertToWebp) publicConfig.convertToPng = false
  } else if (format === 'png') {
    publicConfig.convertToPng = !publicConfig.convertToPng
    if (publicConfig.convertToPng) publicConfig.convertToWebp = false
  }
}

function togglePrivateConvertFormat(format) {
  if (format === 'webp') {
    privateConfig.convertToWebp = !privateConfig.convertToWebp
    if (privateConfig.convertToWebp) privateConfig.convertToPng = false
  } else if (format === 'png') {
    privateConfig.convertToPng = !privateConfig.convertToPng
    if (privateConfig.convertToPng) privateConfig.convertToWebp = false
  }
}

async function savePublicConfig() {
  saving.value = true
  try {
    const result = await settingsStore.savePublicApiConfig({
      enableCompression: publicConfig.enableCompression,
      compressionQuality: publicConfig.compressionQuality,
      convertToWebp: publicConfig.convertToWebp,
      convertToPng: publicConfig.convertToPng,
      rateLimit: publicConfig.rateLimit,
      allowConcurrent: publicConfig.allowConcurrent,
      contentSafety: publicConfig.contentSafety
    })

    if (result.success) {
      toastStore.success('公共上传配置已保存')
    } else {
      toastStore.error(result.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function savePrivateConfig() {
  saving.value = true
  try {
    const result = await settingsStore.savePrivateApiConfig({
      maxFileSize: privateConfig.maxFileSize,
      enableCompression: privateConfig.enableCompression,
      compressionQuality: privateConfig.compressionQuality,
      convertToWebp: privateConfig.convertToWebp,
      convertToPng: privateConfig.convertToPng,
      showOnHomepage: privateConfig.showOnHomepage
    })

    if (result.success) {
      toastStore.success('登录上传配置已保存')
    } else {
      toastStore.error(result.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function saveMediaPolicy() {
  saving.value = true
  try {
    const result = await settingsStore.saveMediaConfig({ ...mediaConfig })
    if (result.success) {
      toastStore.success('媒体策略已保存')
    } else {
      toastStore.error(result.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function createUser() {
  if (!userForm.username.trim() || !userForm.password.trim()) {
    toastStore.error('请输入用户名和密码')
    return
  }

  creatingUser.value = true
  try {
    const result = await settingsStore.createUser({
      username: userForm.username.trim(),
      password: userForm.password.trim()
    })

    if (result.success) {
      toastStore.success('普通用户已创建')
      userForm.username = ''
      userForm.password = ''
      await loadUsers()
    } else {
      toastStore.error(result.message || '创建失败')
    }
  } finally {
    creatingUser.value = false
  }
}

async function toggleUserStatus(user) {
  updatingUserId.value = user.id
  try {
    const result = await settingsStore.updateUser(user.id, {
      status: user.status === 'active' ? 'disabled' : 'active'
    })
    if (result.success) {
      toastStore.success(`用户已${user.status === 'active' ? '禁用' : '启用'}`)
      await loadUsers()
    } else {
      toastStore.error(result.message || '更新失败')
    }
  } finally {
    updatingUserId.value = ''
  }
}

async function addApiKey() {
  if (!newKeyName.value.trim()) {
    toastStore.error('请输入 API Key 名称')
    return
  }
  if (!newKeyOwnerUserId.value) {
    toastStore.error('请选择归属用户')
    return
  }

  const result = await settingsStore.createApiKey({
    name: newKeyName.value.trim(),
    ownerUserId: newKeyOwnerUserId.value
  })
  if (result.success) {
    toastStore.success('API Key 已创建')
    showAddKeyModal.value = false
    newKeyName.value = ''
    newKeyOwnerUserId.value = ''
  } else {
    toastStore.error(result.message || '创建失败')
  }
}

function regenerateKey(key) {
  keyToRegenerate.value = key
  showRegenerateKeyModal.value = true
}

async function doRegenerateKey() {
  if (!keyToRegenerate.value) return

  const result = await settingsStore.updateApiKey(keyToRegenerate.value.id, { regenerate: true })
  if (result.success) {
    toastStore.success('API Key 已更新，旧 Key 已失效')
  } else {
    toastStore.error(result.message || '更新失败')
  }

  showRegenerateKeyModal.value = false
  keyToRegenerate.value = null
}

function confirmDeleteKey(key) {
  keyToDelete.value = key
  showDeleteKeyModal.value = true
}

async function deleteApiKey() {
  if (!keyToDelete.value) return

  const result = await settingsStore.deleteApiKey(keyToDelete.value.id)
  if (result.success) {
    toastStore.success('API Key 已删除')
  } else {
    toastStore.error(result.message || '删除失败')
  }

  showDeleteKeyModal.value = false
  keyToDelete.value = null
}

async function loadUsers() {
  users.value = await settingsStore.fetchUsers()
  if (!newKeyOwnerUserId.value) {
    newKeyOwnerUserId.value = bindableUsers.value[0]?.id || ''
  }
}

onMounted(async () => {
  await Promise.all([
    settingsStore.fetchPublicApiConfig(),
    settingsStore.fetchPrivateApiConfig(),
    settingsStore.fetchMediaConfig(),
    settingsStore.fetchApiKeys(),
    loadUsers()
  ])

  Object.assign(publicConfig, settingsStore.publicApiConfig)
  Object.assign(privateConfig, settingsStore.privateApiConfig)
  Object.assign(mediaConfig, settingsStore.mediaConfig)

  if (!publicConfig.contentSafety) {
    publicConfig.contentSafety = structuredClone(defaultContentSafetyConfig)
  }

  mediaConfig.allowedExtensions = Array.isArray(mediaConfig.allowedExtensions) && mediaConfig.allowedExtensions.length > 0
    ? mediaConfig.allowedExtensions
    : [...availableFormats]
})
</script>
