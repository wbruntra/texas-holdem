import type { Player, Pot, GameState, ValidActions } from './types'

const BACKEND_PORT = 3660
const BASE_URL = `http://localhost:${BACKEND_PORT}`

export interface ApiClientOptions {
  baseUrl?: string
}

export interface JoinResult {
  player: Player
  token: string
  message: string
}

export class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private cookies: Map<string, string> = new Map()

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || BASE_URL
  }

  setToken(token: string | null) {
    this.token = token
  }

  getToken(): string | null {
    return this.token
  }

  clearSession() {
    this.token = null
    this.cookies.clear()
  }

  private getCookieHeader(): string {
    const parts: string[] = []
    this.cookies.forEach((value, key) => {
      parts.push(`${key}=${value}`)
    })
    return parts.join('; ')
  }

  private setCookie(cookieHeader: string) {
    if (!cookieHeader) return
    cookieHeader.split(';').forEach((cookie) => {
      const trimmed = cookie.trim()
      const equalsIndex = trimmed.indexOf('=')
      if (equalsIndex > 0) {
        const name = trimmed.substring(0, equalsIndex)
        const value = trimmed.substring(equalsIndex + 1)
        this.cookies.set(name, value)
      }
    })
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const cookieHeader = this.getCookieHeader()
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      this.setCookie(setCookie)
    }

    const data = await response.json()

    if (!response.ok) {
      const errorData = data as { error?: string }
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    return data as T
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, body?: object): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  async createGame(
    smallBlind: number,
    bigBlind: number,
    startingChips: number,
  ): Promise<{ id: number; roomCode: string }> {
    return this.post('/api/games', { smallBlind, bigBlind, startingChips })
  }

  async getGameByRoomCode(roomCode: string): Promise<any> {
    return this.get(`/api/games/room/${roomCode}`)
  }

  async getGameState(gameId: number): Promise<GameState> {
    return this.get(`/api/games/${gameId}`)
  }

  async joinGame(gameId: number, name: string, password: string): Promise<JoinResult> {
    this.clearSession()
    const result = await this.post<JoinResult>(`/api/games/${gameId}/join`, { name, password })
    if (result.token) {
      this.setToken(result.token)
    }
    return result
  }

  async authenticateGame(gameId: number, name: string, password: string): Promise<JoinResult> {
    this.clearSession()
    const result = await this.post<JoinResult>(`/api/games/${gameId}/auth`, { name, password })
    if (result.token) {
      this.setToken(result.token)
    }
    return result
  }

  async startGame(gameId: number): Promise<GameState> {
    return this.post(`/api/games/${gameId}/start`)
  }

  async performAction(gameId: number, action: string, amount?: number): Promise<GameState> {
    return this.post(`/api/games/${gameId}/actions`, { action, amount })
  }

  async getValidActions(gameId: number): Promise<ValidActions> {
    return this.get(`/api/games/${gameId}/actions/valid`)
  }

  async nextHand(gameId: number): Promise<GameState> {
    return this.post(`/api/games/${gameId}/next-hand`)
  }

  async advanceRound(gameId: number): Promise<GameState> {
    return this.post(`/api/games/${gameId}/advance`)
  }

  async revealCard(gameId: number): Promise<GameState> {
    return this.post(`/api/games/${gameId}/reveal-card`)
  }

  async toggleShowCards(gameId: number, showCards: boolean): Promise<void> {
    await this.post(`/api/games/${gameId}/show-cards`, { showCards })
  }

  async leaveGame(gameId: number): Promise<void> {
    await this.post(`/api/games/${gameId}/leave`)
  }
}

export const api = new ApiClient()
