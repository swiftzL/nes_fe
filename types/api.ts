export interface ApiResponse<T> {
  code: number
  data: T
  msg: string
}

export interface Game {
  game_id: number
  title: string
  type: string
  binary_file: string
  region: string
  language: string
  title_screen_image?: string
  title_screen_image1?: string
  game_uid?: string
  game_binary_file?: string
  click_count?: number
}

export interface GamesPage {
  games: Game[]
  total: number
  page: number
  page_size: number
}

export interface FavoritePayload {
  game_id: number
}

export interface HistoryPayload {
  game_id: number
  play_time: string
}

export type SavePayload = FormData

export interface GameSave {
  id: number
  user_id?: string
  game_id: number
  game_title?: string
  game_image?: string
  save_file: string
  create_time: string
  update_time: string
}

export interface GameHistoryEntry extends Game {
  play_time?: string
  create_time?: string
  update_time?: string
}
