export type WsMessageType = 'hello' | 'subscribed' | 'game_state' | 'error'

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

export interface WsGameStatePayload<T = unknown> {
  state: T
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
