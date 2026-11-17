// 路由守卫：依赖页面自声明的 definePageMeta({ middleware: 'auth', adminOnly? })，
// 不再维护重复的路径清单（新增受保护页面只改页面自身的 meta）
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client) {
    const token = localStorage.getItem('token')

    if (!token) {
      return navigateTo('/login')
    }

    // 管理员专属页面：普通用户重定向首页（前端引导；服务端接口有 403 兜底）
    if (to.meta.adminOnly) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if ((user.role || 'user') !== 'admin') {
          return navigateTo('/')
        }
      } catch {
        return navigateTo('/')
      }
    }
  }
})