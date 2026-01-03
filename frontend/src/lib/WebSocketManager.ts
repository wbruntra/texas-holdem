import type {
  WsMessage,
  WsHelloPayload,
  WsSubscribedPayload,
  WsGameStatePayload,
} from '~/hooks/ws-types'

interface WsHandlers {
  onHello?: (payload: WsHelloPayload) => void
  onSubscribed?: (payload: WsSubscribedPayload) => void
  onGameState?: <T>(payload: WsGameStatePayload<T>) => void
  onError?: (error: string) => void
}

export class WebSocketManager {
  private ws: WebSocket | null = null
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private handlers: WsHandlers
  private currentConfig: { roomCode: string; stream: 'table' | 'player'; gameId?: string } | null =
    null
  private shouldReconnect = true

  constructor(handlers: WsHandlers) {
    this.handlers = handlers
  }

  connect(roomCode: string, stream: 'table' | 'player', gameId?: string): void {
    console.log('[WebSocketManager] Connect called:', { roomCode, stream, gameId })

    this.currentConfig = { roomCode, stream, gameId }
    this.shouldReconnect = true

    this.connectWebSocket()
  }

  private connectWebSocket(): void {
    const config = this.currentConfig
    if (!config) return

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketManager] Already connected')
      return
    }

    this.cleanup()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const isDevelopment =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const wsUrl = isDevelopment
      ? `${protocol}//localhost:3660/ws`
      : `${protocol}//${window.location.host}/ws`

    console.log('[WebSocketManager] Connecting to:', wsUrl)
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('[WebSocketManager] Connected')
      this.handlers.onHello?.({ serverTime: '', protocolVersion: 1, authenticated: false })

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'subscribe',
            payload: {
              roomCode: config.roomCode,
              stream: config.stream,
              gameId: config.gameId,
            },
          }),
        )
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data)

        switch (message.type) {
          case 'hello':
            console.log('[WebSocketManager] Server hello:', message.payload)
            this.handlers.onHello?.(message.payload as WsHelloPayload)
            break

          case 'subscribed':
            console.log(
              '[WebSocketManager] Subscribed to',
              (message.payload as WsSubscribedPayload).stream,
              'stream',
            )
            this.handlers.onSubscribed?.(message.payload as WsSubscribedPayload)
            if (this.pollInterval) {
              clearInterval(this.pollInterval)
              this.pollInterval = null
            }
            break

          case 'game_state':
            console.log(
              '[WebSocketManager] Game state update:',
              (message.payload as WsGameStatePayload).reason,
            )
            this.handlers.onGameState?.(message.payload as WsGameStatePayload)
            break

          case 'error':
            console.error(
              '[WebSocketManager] Server error:',
              (message.payload as { error: string }).error,
            )
            this.handlers.onError?.((message.payload as { error: string }).error)
            break
        }
      } catch (err) {
        console.error('[WebSocketManager] Failed to parse message:', err)
      }
    }

    this.ws.onerror = () => {
      console.error('[WebSocketManager] WebSocket error')
      this.handlers.onError?.('WebSocket error')
    }

    this.ws.onclose = () => {
      console.log('[WebSocketManager] Disconnected')
      this.ws = null

      if (!this.pollInterval) {
        this.startPolling()
      }

      if (this.shouldReconnect && config) {
        console.log('[WebSocketManager] Scheduling reconnect...')
        this.reconnectTimeout = window.setTimeout(() => {
          console.log('[WebSocketManager] Reconnecting...')
          this.connectWebSocket()
        }, 3000)
      }
    }
  }

  private startPolling(): void {
    const config = this.currentConfig
    if (!config) return

    console.log('[WebSocketManager] Starting polling')
    const fetchGame = async () => {
      try {
        const response = await fetch(`/api/games/room/${config.roomCode}/state`)
        const gameState = await response.json()
        this.handlers.onGameState?.({
          state: gameState,
          revision: '0',
          reason: 'poll',
        })
      } catch (err) {
        console.error('[WebSocketManager] Polling error:', err)
        this.handlers.onError?.('Failed to poll game state')
      }
    }

    fetchGame()
    this.pollInterval = window.setInterval(fetchGame, 2000)
  }

  disconnect(): void {
    console.log('[WebSocketManager] Disconnect called')
    this.shouldReconnect = false
    this.cleanup()
  }

  cleanup(): void {
    console.log('[WebSocketManager] Cleanup')

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  isPolling(): boolean {
    return this.pollInterval !== null
  }
}
