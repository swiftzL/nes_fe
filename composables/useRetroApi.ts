import { watch } from 'vue'
import { createError } from 'h3'
import type {
  ApiResponse,
  Game,
  GamesPage,
  FavoritePayload,
  HistoryPayload,
  SavePayload,
  GameSave,
  GameHistoryEntry
} from '~/types/api'

export const useRetroApi = (customToken?: string) => {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase || '/api'
  const authToken = config.apiToken
  const route = useRoute()
  const hasClerk = computed(() => Boolean(config.public?.clerkPublishableKey))
  const { start, finish } = useLoadingIndicator()

  const waitForAuthLoaded = async (auth: ReturnType<typeof useAuth> | null) => {
    if (!auth?.isLoaded) return
    if (auth.isLoaded.value) return
    await new Promise<void>(resolve => {
      const stop = watch(
        () => auth.isLoaded?.value,
        value => {
          if (value) {
            stop()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  // 尝试获取 Clerk session token（仅在客户端且 Clerk 已启用时）
  const getClerkToken = async (): Promise<string | null> => {
    if (!import.meta.client || !hasClerk.value) return null
    try {
      // @ts-ignore - useAuth 由 @clerk/nuxt 动态提供
      const auth = useAuth()
      await waitForAuthLoaded(auth)
      if (!auth?.isSignedIn?.value || !auth?.getToken) {
        return null
      }
      const tokenGetter =
        typeof auth.getToken === 'function'
          ? auth.getToken
          : typeof (auth.getToken as any)?.value === 'function'
            ? (auth.getToken as any).value
            : null
      if (!tokenGetter) {
        return null
      }
      const token = await tokenGetter({ skipCache: true })
      return token || null
    } catch {
      // Clerk 未初始化或未登录
    }
    return null
  }

  const redirectToSignIn = async () => {
    if (!import.meta.client) return
    const redirectTo = route.fullPath || '/'
    await navigateTo({ path: '/sign-in', query: { redirectTo } })
  }

  const unwrap = async <T>(promise: Promise<ApiResponse<T>>): Promise<T> => {
    try {
      start()
      const response = await promise
      if (response.code === 401) {
        // await redirectToSignIn() // 移除自动跳转，防止页面闪烁
        throw createError({ statusCode: 401, statusMessage: '未登录' })
      }
      if (response.code !== 0) {
        throw createError({
          statusCode: 400,
          statusMessage: response.msg || '请求失败'
        })
      }
      return response.data
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // await redirectToSignIn() // 移除自动跳转
        throw createError({ statusCode: 401, statusMessage: '未登录' })
      }
      throw err
    } finally {
      finish()
    }
  }

  const withAuth = async () => {
    const headers: Record<string, string> = {}
    
    // 优先使用传入的自定义 token (如 wx_touch 场景)
    if (customToken) {
      headers.Authorization = customToken.startsWith('Bearer ') ? customToken : `Bearer ${customToken}`
      return headers
    }

    // 服务端使用环境变量 token
    if (import.meta.server && authToken) {
      headers.Authorization = authToken
    }
    // 客户端尝试使用 Clerk token
    if (import.meta.client) {
      const clerkToken = await getClerkToken()
      if (clerkToken) {
        headers.Authorization = `Bearer ${clerkToken}`
      }
    }
    return headers
  }

  return {
    // 公开接口（无需认证）
    fetchTypes: () => unwrap<string[]>($fetch('/games/types', { baseURL })),
    fetchRecommend: (limit = 12) =>
      unwrap<Game[]>($fetch('/games/recommend', { baseURL, params: { limit } })),
    fetchRanking: (limit = 10) =>
      unwrap<Game[]>($fetch('/games/ranking', { baseURL, params: { limit } })),
    fetchGameById: (id: number) =>
      unwrap<Game>($fetch(`/games/${id}`, { baseURL })),
    fetchGamesByType: (params: { type: string; page?: number; page_size?: number; language?: string }) =>
      unwrap<GamesPage>($fetch('/games/type', { baseURL, params })),
    searchByTitle: (title: string) =>
      unwrap<Game[]>($fetch('/games/search', { baseURL, params: { title } })),

    // 用户接口（需要认证）
    fetchFavorites: async () => {
      const headers = await withAuth()
      return unwrap<Game[]>($fetch('/user/favorites', { baseURL, headers }))
    },
    addFavorite: async (payload: FavoritePayload) => {
      const headers = await withAuth()
      return unwrap<void>(
        $fetch('/user/favorites', { baseURL, method: 'POST', body: payload, headers })
      )
    },
    removeFavorite: async (gameId: number) => {
      const headers = await withAuth()
      return unwrap<void>(
        $fetch(`/user/favorites/${gameId}`, { baseURL, method: 'DELETE', headers })
      )
    },
    checkFavorite: async (gameId: number) => {
      const headers = await withAuth()
      return unwrap<{ is_favorite: boolean }>(
        $fetch(`/user/favorites/${gameId}/check`, { baseURL, headers })
      )
    },
    fetchHistory: async (limit = 50) => {
      const headers = await withAuth()
      return unwrap<GameHistoryEntry[]>(
        $fetch('/user/history', { baseURL, params: { limit }, headers })
      )
    },
    addHistory: async (payload: HistoryPayload) => {
      const headers = await withAuth()
      return unwrap<void>(
        $fetch('/user/history', { baseURL, method: 'POST', body: payload, headers })
      )
    },
    uploadSave: async (payload: SavePayload) => {
      const headers = await withAuth()
      return unwrap<{ save_url: string }>(
        $fetch('/user/saves', { baseURL, method: 'POST', body: payload, headers })
      )
    },
    fetchSave: async (gameId: number) => {
      const headers = await withAuth()
      return unwrap<GameSave>($fetch(`/user/saves/${gameId}`, { baseURL, headers }))
    },
    fetchAllSaves: async () => {
      const headers = await withAuth()
      return unwrap<GameSave[]>($fetch('/user/saves', { baseURL, headers }))
    },
    deleteSave: async (gameId: number) => {
      const headers = await withAuth()
      return unwrap<void>($fetch(`/user/saves/${gameId}`, { baseURL, method: 'DELETE', headers }))
    }
  }
}
