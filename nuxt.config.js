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
      },
      // 全站增量式 CSP：object-src/base-uri/form-action/frame-ancestors 提供
      // 实际防护；script-src 暂需 'unsafe-inline'（Nuxt SPA 内联引导脚本），
      // 完整 nonce 方案待后续版本。SVG 直链由 /i/ 处理器下发更严格的专属 CSP。
      '/**': {
        headers: {
          'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https: http:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
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