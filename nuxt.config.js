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

  modules: [
    '@pinia/nuxt',
    '@nuxt/icon'
  ],

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
    experimental: {
      bodySizeLimit: 100 * 1024 * 1024
    },
    routeRules: {
      '/api/**': {
        cors: false,
        headers: {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
        }
      }
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