module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },

  // Nitro / Nuxt 自动导入——声明为全局，避免 no-undef 假阳性。
  // 真正的"模板引用无主变量"（如 toggleConvertFormat 未声明）仍会被拦截。
  globals: {
    // Nitro server
    createError: 'readonly',
    defineEventHandler: 'readonly',
    defineNitroPlugin: 'readonly',
    getHeader: 'readonly',
    getQuery: 'readonly',
    getRequestIP: 'readonly',
    getRouterParam: 'readonly',
    readBody: 'readonly',
    readMultipartFormData: 'readonly',
    sendStream: 'readonly',
    setHeader: 'readonly',
    setResponseStatus: 'readonly',
    useRuntimeConfig: 'readonly',
    // Vue Composition API（Nuxt auto-import）
    ref: 'readonly',
    computed: 'readonly',
    reactive: 'readonly',
    watch: 'readonly',
    watchEffect: 'readonly',
    onMounted: 'readonly',
    onUnmounted: 'readonly',
    nextTick: 'readonly',
    defineProps: 'readonly',
    defineEmits: 'readonly',
    defineExpose: 'readonly',
    definePageMeta: 'readonly',
    // Nuxt routing/util
    navigateTo: 'readonly',
    useRoute: 'readonly',
    useRouter: 'readonly',
    useHead: 'readonly',
    useNuxtApp: 'readonly',
    useFetch: 'readonly',
    useAsyncData: 'readonly',
    useClipboard: 'readonly',
    defineNuxtRouteMiddleware: 'readonly',
    // Nuxt utilities
    '$fetch': 'readonly',
    // Custom composables（Nuxt auto-imports from app/composables/）
    useMediaSrc: 'readonly',
    useConfigForm: 'readonly',
    useConvertToggle: 'readonly',
    defineNuxtPlugin: 'readonly',
    // server/utils auto-imports（Nitro 扫描 server/utils 目录下的导出）
    USER_ROLES: 'readonly',
    generateToken: 'readonly',
    getMediaOwnerFromUser: 'readonly',
    getUploadPolicy: 'readonly',
    migrateToUploadPolicy: 'readonly',
    requireAuthUser: 'readonly',
    resolveUploadRole: 'readonly',
  },

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: '@babel/eslint-parser',
    requireConfigFile: false
  },

  rules: {
    // 核心目标：拦截"模板/闭包引用无主变量"（同类问题已两次出现：
    // toggleConvertFormat / importSuccessCount）
    'no-undef': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },

  overrides: [
    {
      files: ['*.vue'],
      parser: 'vue-eslint-parser',
      parserOptions: {
        parser: '@babel/eslint-parser',
        requireConfigFile: false
      }
    },
    {
      files: ['*.mjs'],
      parserOptions: { sourceType: 'module' }
    }
  ],

  ignorePatterns: [
    'node_modules/', '.nuxt/', '.output/', 'dist/',
    'pnpm-lock.yaml'
  ]
}
