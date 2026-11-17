import { readFileSync } from 'fs'
import { resolve } from 'path'

// 在构建时读取 package.json 的版本号
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))
const appVersion = packageJson.version || '1.0.0'

export default defineNuxtConfig({
  ssr: false, // 关闭服务端渲染，变成纯 SPA

  future: {
    compatibilityVersion: 4
  },

  compatibilityDate: '2025-12-12',

  // SPA 首屏 loading（ssr:false 下 JS 加载期间展示，消除慢网白屏）
  spaLoadingTemplate: true,

  modules: [
    '@pinia/nuxt',
    '@nuxt/icon'
  ],

  // 图标本地化：构建期扫描源码使用的图标并打包进客户端 bundle，
  // 运行时不再请求 api.iconify.design（离线可用 + CSP 无需外域白名单）
  icon: {
    clientBundle: {
      scan: true,
      // 显式枚举全部使用中的图标（scan 对 layouts 等目录覆盖不全时兜底），
      // 新增图标请同步此清单
      icons: [
      "heroicons:arrow-down-tray",      "heroicons:arrow-left-on-rectangle",      "heroicons:arrow-path",      "heroicons:arrow-right-on-rectangle",      "heroicons:arrow-up",      "heroicons:bell",      "heroicons:chart-bar",      "heroicons:chat-bubble-left-right",      "heroicons:check-circle",      "heroicons:check-solid",      "heroicons:clipboard-document",      "heroicons:clock",      "heroicons:cloud-arrow-up",      "heroicons:code-bracket",      "heroicons:cog-6-tooth",      "heroicons:envelope",      "heroicons:exclamation-circle",      "heroicons:exclamation-triangle",      "heroicons:eye",      "heroicons:eye-slash",      "heroicons:globe-alt",      "heroicons:home",      "heroicons:information-circle",      "heroicons:link",      "heroicons:lock-closed",      "heroicons:megaphone",      "heroicons:moon-solid",      "heroicons:no-symbol",      "heroicons:paper-airplane",      "heroicons:photo",      "heroicons:play",      "heroicons:rocket-launch",      "heroicons:shield-exclamation",      "heroicons:sparkles",      "heroicons:sun-solid",      "heroicons:trash",      "heroicons:user",      "heroicons:x-circle",      "heroicons:x-mark"
      ]
    }
  },

  css: [
    '~/assets/css/main.css'
  ],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'OneImg',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'OneImg：简单易用的个人媒体床' }
      ]
      // favicon 由客户端动态设置，避免页面刷新时闪动
    }
  },

  nitro: {
    // 移除 x-powered-by 响应头
    
    experimental: {
      bodySizeLimit: 100 * 1024 * 1024
    },
    routeRules: {
      '/**': { headers: { 'x-powered-by': '' } },
      '/api/**': {
        cors: false,
        headers: {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
        }
      },
      // 全站 CSP 由 server/plugins/csp-nonce.js 统一下发（唯一出口）：
      // script-src 带 nonce；style-src 保留 unsafe-inline（SPA 动态样式注入所需）。
      // SVG 直链由 /i/ 处理器下发更严格的专属 CSP。
    },
    // 预渲染完成后强制退出进程
    // 这是为了解决某些模块（如数据库连接、定时器）可能保持进程活跃的问题
    hooks: {
      'prerender:done'() {
        console.log('[Nitro] 预渲染完成，退出进程...')
        setTimeout(() => {
          process.exit(0)
        }, 1000)
      }
    }
  },

  runtimeConfig: {
    // 服务端运行时配置（不会暴露给客户端）
    appVersion,
    public: {
      apiBase: ''
    }
  }
})