// 路由守卫：依赖页面自声明的 definePageMeta({ middleware: 'auth', adminOnly? })，
// 不再维护重复的路径清单（新增受保护页面只改页面自身的 meta）
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.client) {
    const token = localStorage.getItem('token')

    if (!token) {
      return navigateTo('/login', { redirect: { path: to.path, query: to.query } })
    }

    // 管理员专属页面：普通用户重定向首页（前端引导；服务端接口有 403 兜底）
    // 使用 authStore（verify 后的角色），不直接信任 localStorage（中危6）
    if (to.meta.adminOnly) {
      // 使用 Nuxt auto-import 的 useAuthStore（middleware 内可用）
      const { useAuthStore } = await import('~/stores/auth')
      const authStore = useAuthStore()
      if (!authStore.isAdmin) {
        return navigateTo('/')
      }
    }
  }
})