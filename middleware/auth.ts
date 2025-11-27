export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig()
  const hasClerk = Boolean(config.public?.clerkPublishableKey)

  // 如果没有配置 Clerk，不进行拦截
  if (!hasClerk) return

  // 仅在客户端检查登录状态
  if (process.client) {
    try {
      const { isSignedIn } = useAuth()

      // 等待 Clerk 初始化
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (!isSignedIn.value) {
        return navigateTo({
          path: '/sign-in',
          query: { redirectTo: to.fullPath }
        })
      }
    } catch {
      // Clerk 未初始化，跳过检查
    }
  }
})

