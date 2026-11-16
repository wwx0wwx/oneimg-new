// 路由守卫中间件 - 保护需要登录/管理员权限的页面
// 页面通过 definePageMeta({ middleware: 'auth', adminOnly: true }) 声明仅管理员可访问
export default defineNuxtRouteMiddleware((to, from) => {
  // 需要登录的页面
  const protectedRoutes = ['/api', '/settings', '/stats', '/notification']

  // 检查是否是受保护的路由
  const isProtectedRoute = protectedRoutes.some(route => to.path.startsWith(route))

  if (!isProtectedRoute) {
    return
  }

  // 仅在客户端检查
  if (import.meta.client) {
    const token = localStorage.getItem('token')

    if (!token) {
      // 未登录，重定向到登录页
      return navigateTo('/login')
    }

    // 管理员专属页面：普通用户重定向首页（前端引导；服务端接口本身有 403 兜底）
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