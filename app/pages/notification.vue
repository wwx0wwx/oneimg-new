<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-8">通知设置</h1>

    <div class="space-y-6">
      <!-- 通知总开关 -->
      <div class="card p-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">启用通知</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              开启后，系统将在特定事件发生时发送通知
            </p>
          </div>
          <ToggleSwitch v-model="config.enabled" />
        </div>
      </div>

      <!-- 通知类型开关 -->
      <div class="card p-6" v-if="config.enabled">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <Icon name="heroicons:bell" class="w-5 h-5 inline-block mr-2 text-primary-500" />
          通知类型
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          选择需要接收通知的事件类型
        </p>

        <div class="space-y-4">
          <!-- 登录通知 -->
          <div class="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">登录通知</label>
              <p class="text-xs text-gray-500 dark:text-gray-400">当管理员登录时发送通知</p>
            </div>
            <ToggleSwitch v-model="config.types.login" />
          </div>

          <!-- 媒体上传通知 -->
          <div class="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">媒体上传通知</label>
              <p class="text-xs text-gray-500 dark:text-gray-400">当有新的图片或视频上传时发送通知</p>
            </div>
            <ToggleSwitch v-model="config.types.upload" />
          </div>

          <!-- 鉴黄检测结果通知 -->
          <div class="flex items-center justify-between py-3">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">鉴黄检测结果通知</label>
              <p class="text-xs text-gray-500 dark:text-gray-400">当图片内容审核完成时发送通知（特别是检测到违规内容时）</p>
            </div>
            <ToggleSwitch v-model="config.types.nsfw" />
          </div>
        </div>
      </div>

      <!-- 通知方式 -->
      <div class="card p-6" v-if="config.enabled">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <Icon name="heroicons:paper-airplane" class="w-5 h-5 inline-block mr-2 text-primary-500" />
          通知方式
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              选择通知方式
            </label>
            <select v-model="config.method" class="input">
              <option value="telegram">Telegram</option>
              <option value="email">Email 邮件</option>
              <option value="serverchan">Server酱</option>
              <option value="webhook">Webhook</option>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              支持 Webhook、Telegram、Email 和 Server酱 通知方式
            </p>
          </div>
        </div>
      </div>

      <!-- Webhook 配置 -->
      <div class="card p-6" v-if="config.enabled && config.method === 'webhook'">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <Icon name="heroicons:link" class="w-5 h-5 inline-block mr-2 text-primary-500" />
          Webhook 配置
        </h2>

        <div class="space-y-4">
          <!-- Webhook URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Webhook URL <span class="text-red-500">*</span>
            </label>
            <input
              v-model="config.webhook.url"
              type="url"
              class="input"
              placeholder="https://example.com/webhook"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              接收通知的 Webhook 地址
            </p>
          </div>

          <!-- 请求方法 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              请求方法
            </label>
            <select v-model="config.webhook.method" class="input">
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>

          <!-- Content-Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content-Type
            </label>
            <select v-model="config.webhook.contentType" class="input">
              <option value="application/json">application/json</option>
              <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
              <option value="text/plain">text/plain</option>
            </select>
          </div>

          <!-- 自定义请求头 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              自定义请求头 (JSON)
            </label>
            <textarea
              v-model="headersJson"
              rows="3"
              class="input font-mono text-sm"
              placeholder='{"Authorization": "Bearer your-token"}'
            ></textarea>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              JSON 格式的自定义请求头，如认证信息等
            </p>
            <p v-if="headersError" class="text-xs text-red-500 mt-1">{{ headersError }}</p>
          </div>

          <!-- 请求体模板 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              请求体模板 (JSON)
            </label>
            <textarea
              v-model="config.webhook.bodyTemplate"
              rows="10"
              class="input font-mono text-sm"
              placeholder='{"type": "{{type}}", "title": "{{title}}", "message": "{{message}}"}'
            ></textarea>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              支持以下变量：<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{{ templateVars.type }}</code>、
              <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{{ templateVars.title }}</code>、
              <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{{ templateVars.message }}</code>、
              <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{{ templateVars.timestamp }}</code>、
              <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{{ templateVars.data }}</code>
            </p>
          </div>

          <!-- 测试按钮 -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="runChannelTest('webhook')"
              class="btn-secondary"
              :disabled="testing === 'webhook' || !config.webhook.url"
            >
              <Icon name="heroicons:paper-airplane" class="w-4 h-4 mr-2" />
              {{ testing === 'webhook' ? '测试中...' : '发送测试通知' }}
            </button>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              点击发送一条测试通知，验证 Webhook 配置是否正确。
              <span class="text-orange-500">注意：目标 URL 的重定向（301/302）不会被跟随，请填最终地址。</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Telegram 配置 -->
      <div class="card p-6" v-if="config.enabled && config.method === 'telegram'">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <Icon name="heroicons:chat-bubble-left-right" class="w-5 h-5 inline-block mr-2 text-primary-500" />
          Telegram 配置
        </h2>

        <div class="space-y-4">
          <!-- Bot Token -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bot Token <span class="text-red-500">*</span>
            </label>
            <input
              v-model="config.telegram.token"
              type="text"
              class="input"
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              从 <a href="https://t.me/BotFather" target="_blank" class="text-primary-500 hover:underline">@BotFather</a> 获取的 Bot Token
            </p>
          </div>

          <!-- Chat ID -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chat ID <span class="text-red-500">*</span>
            </label>
            <input
              v-model="config.telegram.chatId"
              type="text"
              class="input"
              placeholder="123456789"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              接收通知的用户或群组 Chat ID，可通过 <a href="https://t.me/userinfobot" target="_blank" class="text-primary-500 hover:underline">@userinfobot</a> 获取【注意: 需要先给bot发送一条消息】
            </p>
          </div>

          <!-- 测试按钮 -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="runChannelTest('telegram')"
              class="btn-secondary"
              :disabled="testing === 'telegram' || !config.telegram.token || !config.telegram.chatId"
            >
              <Icon name="heroicons:paper-airplane" class="w-4 h-4 mr-2" />
              {{ testing === 'telegram' ? '测试中...' : '发送测试通知' }}
            </button>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              点击发送一条测试通知，验证 Telegram 配置是否正确
            </p>
          </div>
        </div>
      </div>

      <!-- Email 配置 -->
      <div class="card p-6" v-if="config.enabled && config.method === 'email'">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <Icon name="heroicons:envelope" class="w-5 h-5 inline-block mr-2 text-primary-500" />
          Email 配置
        </h2>

        <div class="space-y-4">
          <!-- 邮件服务商 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              邮件服务商 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="config.email.service"
              type="text"
              class="input"
              placeholder="例如: QQ、126、163、Gmail"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              支持列表: <a href="https://github.com/nodemailer/nodemailer/blob/master/lib/well-known/services.json" target="_blank" class="text-primary-500 hover:underline">点击查询</a>
            </p>
          </div>

          <!-- 发件人邮箱 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              发件人邮箱 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="config.email.user"
              type="email"
              class="input"
              placeholder="your-email@example.com"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              用于发送通知的邮箱地址
            </p>
          </div>

          <!-- 邮箱授权码 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              邮箱授权码/密码 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="config.email.pass"
              type="password"
              class="input"
              placeholder="邮箱授权码或密码"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              大多数邮箱需要使用授权码而非登录密码，请在邮箱设置中获取
            </p>
          </div>

          <!-- 收件人邮箱 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              收件人邮箱
            </label>
            <input
              v-model="config.email.to"
              type="email"
              class="input"
              placeholder="留空则发送给自己"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              接收通知的邮箱地址，留空则发送给发件人邮箱
            </p>
          </div>

          <!-- 测试按钮 -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="runChannelTest('email')"
              class="btn-secondary"
              :disabled="testing === 'email' || !config.email.service || !config.email.user || !config.email.pass"
            >
              <Icon name="heroicons:paper-airplane" class="w-4 h-4 mr-2" />
              {{ testing === 'email' ? '测试中...' : '发送测试通知' }}
            </button>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              点击发送一条测试通知，验证邮件配置是否正确
            </p>
          </div>
        </div>
      </div>

      <!-- Server酱 配置 -->
      <div class="card p-6" v-if="config.enabled && config.method === 'serverchan'">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <Icon name="heroicons:megaphone" class="w-5 h-5 inline-block mr-2 text-primary-500" />
          Server酱 配置
        </h2>

        <div class="space-y-4">
          <!-- SendKey -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SendKey <span class="text-red-500">*</span>
            </label>
            <input
              v-model="config.serverchan.sendKey"
              type="text"
              class="input"
              placeholder="SCTxxxxxxxxxxxxxxxxxxxxx"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              从 <a href="https://sct.ftqq.com/r/9338" target="_blank" class="text-primary-500 hover:underline">Server酱官网</a> 获取的 SendKey
            </p>
          </div>

          <!-- 测试按钮 -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="runChannelTest('serverchan')"
              class="btn-secondary"
              :disabled="testing === 'serverchan' || !config.serverchan.sendKey"
            >
              <Icon name="heroicons:paper-airplane" class="w-4 h-4 mr-2" />
              {{ testingServerChan ? '测试中...' : '发送测试通知' }}
            </button>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              点击发送一条测试通知，验证 Server酱 配置是否正确
            </p>
          </div>
        </div>
      </div>

      <!-- 保存按钮 -->
      <div class="flex justify-end">
        <button
          type="button"
          @click="saveConfig"
          class="btn-primary"
          :disabled="saving || loading"
        >
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToastStore } from '~/stores/toast'

// 使用认证中间件
definePageMeta({
  middleware: 'auth',
  adminOnly: true
})

const authStore = useAuthStore()
const toastStore = useToastStore()

// 配置状态
const config = reactive({
  enabled: false,
  method: 'telegram',
  types: {
    login: true,
    upload: true,
    nsfw: true
  },
  webhook: {
    url: '',
    method: 'POST',
    contentType: 'application/json',
    headers: {},
    bodyTemplate: JSON.stringify({
      type: '{{type}}',
      title: '{{title}}',
      message: '{{message}}',
      timestamp: '{{timestamp}}',
      data: '{{data}}'
    }, null, 2)
  },
  telegram: {
    token: '',
    chatId: ''
  },
  email: {
    service: '',
    user: '',
    pass: '',
    to: ''
  },
  serverchan: {
    sendKey: ''
  }
})

// 请求头 JSON 字符串（用于编辑）
const headersJson = ref('{}')
const headersError = ref('')

// 监听 headersJson 变化，解析为对象
watch(headersJson, (newVal) => {
  try {
    config.webhook.headers = JSON.parse(newVal || '{}')
    headersError.value = ''
  } catch (e) {
    headersError.value = 'JSON 格式错误'
  }
})

// 模板变量显示文本（避免被 Vue 解析）
const templateVars = {
  type: '{{type}}',
  title: '{{title}}',
  message: '{{message}}',
  timestamp: '{{timestamp}}',
  data: '{{data}}'
}

// 加载状态
const loading = ref(false)
const saving = ref(false)
const testing = ref('')

// 获取配置
async function fetchConfig() {
  loading.value = true
  try {
    const response = await $fetch('/api/notification', {
      headers: authStore.authHeader
    })

    if (response.success) {
      Object.assign(config, response.data)
      // 同步 headers 到 JSON 字符串
      headersJson.value = JSON.stringify(config.webhook.headers || {}, null, 2)
    }
  } catch (error) {
    console.error('获取通知配置失败:', error)
    toastStore.error('获取通知配置失败')
  } finally {
    loading.value = false
  }
}

// 保存配置
async function saveConfig() {
  // 验证 headers JSON
  try {
    config.webhook.headers = JSON.parse(headersJson.value || '{}')
  } catch (e) {
    toastStore.error('请求头 JSON 格式错误')
    return
  }

  saving.value = true
  try {
    const response = await $fetch('/api/notification', {
      method: 'PUT',
      body: config,
      headers: authStore.authHeader
    })

    if (response.success) {
      toastStore.success('通知配置已保存')
    } else {
      toastStore.error(response.message || '保存失败')
    }
  } catch (error) {
    console.error('保存通知配置失败:', error)
    toastStore.error(error.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 初始化
onMounted(() => {
  fetchConfig()
})

// 统一测试入口：四个渠道的测试请求只有 method/payload 不同（历史上 130 行 × 4 份拷贝）
async function runChannelTest(method) {
  testing.value = method
  testResult.value = null
  try {
    const body = {
      method,
      webhook: { url: config.webhook.url, method: config.webhook.method, contentType: config.webhook.contentType, headers: config.webhook.headers, bodyTemplate: config.webhook.bodyTemplate },
      telegram: { token: config.telegram.token, chatId: config.telegram.chatId },
      email: { service: config.email.service, user: config.email.user, pass: config.email.pass, to: config.email.to },
      serverchan: { sendKey: config.serverchan.sendKey }
    }
    const response = await $fetch('/api/notification/test', {
      method: 'POST',
      headers: authStore.authHeader,
      body
    })
    if (response.success) {
      toastStore.success('测试通知发送成功')
    } else {
      toastStore.error(response.message || '测试失败')
    }
  } catch (error) {
    toastStore.error(error?.data?.message || '测试失败')
  } finally {
    testing.value = ''
  }
}
</script>