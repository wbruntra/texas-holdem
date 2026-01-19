export type WsMessageType = 'hello' | 'subscribed' | 'game_state' | 'error' | 'ping' | 'pong'

export interface WsMessage {
  type: WsMessageType
  requestId?: string
  payload?: unknown
}

export interface WsHelloPayload {
  serverTime: string
  protocolVersion: number
  authenticated: boolean
}

export interface WsSubscribedPayload {
  gameId: string
  roomCode: string
  stream: 'table' | 'player'
  authenticated: boolean
}

export interface WsGameStatePayload<TGameState = unknown> {
  state: TGameState
  revision: string
  reason: string
}

export interface WsErrorPayload {
  error: string
}

export interface WsSubscribePayload {
  roomCode: string
  stream: 'table' | 'player'
  gameId?: string
  playerId?: string
  token?: string
}

export type WsConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'

export interface WsConfig {
  roomCode: string
  stream: 'table' | 'player'
  gameId?: string
  playerId?: string
  token?: string
}

export interface WsEventHandlers {
  onHello?: (payload: WsHelloPayload) => void
  onSubscribed?: (payload: WsSubscribedPayload) => void
  onGameState?: (state: unknown, reason: string) => void
  onError?: (error: string) => void
  onOpen?: () => void
  onClose?: () => void
}
