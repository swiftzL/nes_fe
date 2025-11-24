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

export const useRetroApi = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase || '/api'
  const authToken = config.apiToken
  const route = useRoute()
  const redirectToSignIn = async () => {
    if (!process.client) return
    const redirectTo = route.fullPath || '/'
    await navigateTo({ path: '/sign-in', query: { redirectTo } })
  }

  const unwrap = async <T>(promise: Promise<ApiResponse<T>>): Promise<T> => {
    try {
      const response = await promise
      if (response.code === 401) {
        await redirectToSignIn()
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
        await redirectToSignIn()
      }
      throw err
    }
  }

  const withAuth = () => {
    const headers: Record<string, string> = {}
    if (process.server && authToken) {
      headers.Authorization = authToken
    }
    return headers
  }

  return {
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
    fetchFavorites: () =>
      unwrap<Game[]>($fetch('/user/favorites', { baseURL, headers: withAuth() })),
    addFavorite: (payload: FavoritePayload) =>
      unwrap<void>(
        $fetch('/user/favorites', { baseURL, method: 'POST', body: payload, headers: withAuth() })
      ),
    removeFavorite: (gameId: number) =>
      unwrap<void>(
        $fetch(`/user/favorites/${gameId}`, { baseURL, method: 'DELETE', headers: withAuth() })
      ),
    checkFavorite: (gameId: number) =>
      unwrap<{ is_favorite: boolean }>(
        $fetch(`/user/favorites/${gameId}/check`, { baseURL, headers: withAuth() })
      ),
    fetchHistory: (limit = 50) =>
      unwrap<GameHistoryEntry[]>(
        $fetch('/user/history', { baseURL, params: { limit }, headers: withAuth() })
      ),
    addHistory: (payload: HistoryPayload) =>
      unwrap<void>(
        $fetch('/user/history', { baseURL, method: 'POST', body: payload, headers: withAuth() })
      ),
    uploadSave: (payload: SavePayload) =>
      unwrap<{ save_url: string }>(
        $fetch('/user/saves', {
          baseURL,
          method: 'POST',
          body: payload,
          headers: withAuth()
        })
      ),
    fetchSave: (gameId: number) =>
      unwrap<GameSave>($fetch(`/user/saves/${gameId}`, { baseURL, headers: withAuth() })),
    fetchAllSaves: () => unwrap<GameSave[]>($fetch('/user/saves', { baseURL, headers: withAuth() })),
    deleteSave: (gameId: number) =>
      unwrap<void>($fetch(`/user/saves/${gameId}`, { baseURL, method: 'DELETE', headers: withAuth() }))
  }
}
