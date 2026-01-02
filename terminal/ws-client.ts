import type { GameState } from './types'

export type WsMessageType = 'hello' | 'subscribed' | 'game_state' | 'error'

export interface WsMessage {
  type: WsMessageType
  requestId?: string
  payload?: any
}

export interface WsHandler {
  onHello?: (payload: {
    serverTime: string
    protocolVersion: number
    authenticated: boolean
  }) => void
  onSubscribed?: (payload: {
    gameId: number
    roomCode: string
    stream: string
    authenticated: boolean
  }) => void
  onGameState?: (state: GameState, reason: string) => void
  onError?: (error: string) => void
  onClose?: () => void
  onOpen?: () => void
}

export class WsClient {
  private ws: WebSocket | null = null
  private url: string
  private handlers: WsHandler = {}
  private autoReconnect = true
  private reconnectDelay = 3000
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private roomCode: string = ''
  private stream: string = ''
  private gameId: string = ''
  private playerId: string = ''
  private token: string = ''
  private connected = false

  constructor(url: string) {
    this.url = url
  }

  connect(
    roomCode: string,
    stream: 'table' | 'player',
    gameId: string,
    playerId: string = '',
    token: string = '',
  ) {
    this.roomCode = roomCode
    this.stream = stream
    this.gameId = gameId
    this.playerId = playerId
    this.token = token

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.connected = true
      this.handlers.onOpen?.()
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.handlers.onClose?.()

      if (this.autoReconnect) {
        this.reconnectTimeout = setTimeout(() => {
          this.resubscribe()
        }, this.reconnectDelay)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  private handleMessage(message: WsMessage) {
    switch (message.type) {
      case 'hello':
        this.handlers.onHello?.(message.payload)
        break
      case 'subscribed':
        this.handlers.onSubscribed?.(message.payload)
        break
      case 'game_state':
        this.handlers.onGameState?.(message.payload.state, message.payload.reason)
        break
      case 'error':
        this.handlers.onError?.(message.payload.error)
        break
    }
  }

  private resubscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        payload: {
          roomCode: this.roomCode,
          stream: this.stream,
          gameId: this.gameId,
          playerId: this.playerId,
          token: this.token,
        },
      })
    }
  }

  send(message: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  subscribe(
    roomCode: string,
    stream: 'table' | 'player',
    gameId: string,
    playerId?: string,
    token?: string,
  ) {
    this.send({
      type: 'subscribe',
      payload: {
        roomCode,
        stream,
        gameId,
        playerId,
        token,
      },
    })
  }

  setHandlers(handlers: WsHandler) {
    this.handlers = { ...this.handlers, ...handlers }
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }

  close() {
    this.autoReconnect = false
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export function createWsUrl(port: number, isDev: boolean = true): string {
  const protocol = isDev ? 'ws:' : 'wss:'
  return `${protocol}//localhost:${port}/ws`
}
