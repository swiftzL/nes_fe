/**
 * 统一认证状态管理
 * 支持两种认证方式：
 * 1. Clerk 用户登录（客户端）
 */
export const useAuthState = () => {
  const runtime = useRuntimeConfig()
  const hasClerk = computed(() => Boolean(runtime.public?.clerkPublishableKey))
  const hasEnvToken = computed(() => Boolean(runtime.public.hasAuth))

  // 客户端 Clerk 登录状态
  const isClerkSignedIn = ref(false)
  const clerkUser = ref<{ id?: string; email?: string; fullName?: string } | null>(null)

  // 初始化 Clerk 状态（仅客户端）
  const initClerkState = () => {
    if (!process.client || !hasClerk.value) return

    try {
      // @ts-ignore - useUser 由 @clerk/nuxt 动态提供
      const { isSignedIn, user } = useUser()

      watch(
        () => isSignedIn.value,
        (val) => {
          isClerkSignedIn.value = val ?? false
        },
        { immediate: true }
      )

      watch(
        () => user.value,
        (val) => {
          if (val) {
            clerkUser.value = {
              id: val.id,
              email: val.primaryEmailAddress?.emailAddress,
              fullName: val.fullName ?? undefined
            }
          } else {
            clerkUser.value = null
          }
        },
        { immediate: true }
      )
    } catch {
      // Clerk 未初始化
    }
  }

  // 是否已认证（Clerk 登录或有环境变量 Token）
  const isAuthenticated = computed(() => {
    if (process.server) {
      // 服务端只检查环境变量
      return hasEnvToken.value
    }
    // 客户端优先检查 Clerk，否则检查环境变量
    return isClerkSignedIn.value || hasEnvToken.value
  })

  // 认证方式描述
  const authMethod = computed(() => {
    if (isClerkSignedIn.value) return 'clerk'
    if (hasEnvToken.value) return 'token'
    return 'none'
  })

  // 用户显示名称
  const displayName = computed(() => {
    if (clerkUser.value?.fullName) return clerkUser.value.fullName
    if (clerkUser.value?.email) return clerkUser.value.email
    if (hasEnvToken.value) return '开发者模式'
    return '未登录'
  })

  return {
    hasClerk,
    hasEnvToken,
    isClerkSignedIn,
    clerkUser,
    isAuthenticated,
    authMethod,
    displayName,
    initClerkState
  }
}

