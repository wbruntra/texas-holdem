import { WsClient, createWsUrl } from './ws-client'
import { MenuSystem } from './menu'
import { Display } from './display'
import { ActionSelector, type ActionResult } from './action-selector'
import { api, ApiClient } from './api-client'
import type { GameState, ValidActions } from './types'
import { sessionStorage } from './session-storage'
import { BACKEND_LOCAL_PORT } from '../shared/config'

export class GameLoop {
  private ws: WsClient | null = null
  private gameId: number | null = null
  private roomCode: string = ''
  private playerName: string = ''
  private playerId: string = ''
  private gameState: GameState | null = null
  private autoRefresh = false
  private refreshInterval: ReturnType<typeof setInterval> | null = null
  private isHandlingTurn = false

  constructor(
    private api: ApiClient,
    private menu: MenuSystem,
    private display: Display,
    private actionSelector: ActionSelector,
  ) {}

  async run(
    gameId: number,
    roomCode: string,
    playerName: string,
    password: string,
  ): Promise<void> {
    this.gameId = gameId
    this.roomCode = roomCode.toUpperCase()
    this.playerName = playerName

    const state = await this.api.getGameState(gameId)
    const me = state.players.find((p) => p.name === playerName)
    if (me) {
      this.playerId = me.id
    }
    this.gameState = state

    sessionStorage.save({
      roomCode: this.roomCode,
      playerName: this.playerName,
      password: password,
      gameId: this.gameId,
    })

    console.log(`\n✓ Joined game as ${playerName}`)
    await this.loop()
  }

  private async loop(): Promise<void> {
    if (!this.gameId) return

    this.connectWebSocket()

    process.stdout.write('\n=== Game Active ===\n\n> ')

    if (this.gameState && this.isMyTurn(this.gameState)) {
      await this.handleTurn()
    } else {
      await this.handleIdle()
    }
  }

  private async handleTurn(): Promise<void> {
    if (!this.gameId) return
    this.isHandlingTurn = true

    await this.fetchValidActions()

    if (!this.gameState || !this.validActions) {
      this.isHandlingTurn = false
      await this.loop()
      return
    }

    const isShowdown = this.gameState.currentRound === 'showdown'
    const result = await this.actionSelector.selectAction(this.validActions, isShowdown)

    if (!result) {
      this.isHandlingTurn = false
      await this.loop()
      return
    }

    if (result.action === 'back') {
      this.isHandlingTurn = false
      await this.loop()
      return
    }

    if (result.action === 'refresh' && !isShowdown) {
      this.isHandlingTurn = false
      await this.handleTurn()
      return
    }

    if (result.action === 'quit') {
      this.isHandlingTurn = false
      this.cleanup()
      return
    }

    if (result.action === 'help') {
      this.actionSelector.showHelp()
      await this.handleTurn()
      return
    }

    if (result.action === 'next_hand') {
      await this.nextHand()
    } else if (result.action === 'next') {
      await this.nextHand()
    } else if (result.action === 'advance') {
      await this.advanceRound()
    } else if (result.action === 'refresh') {
      await this.refreshState()
    } else {
      await this.performAction(result.action, result.amount)
    }

    this.isHandlingTurn = false
    await this.loop()
  }

  private async handleIdle(): Promise<void> {
    if (!this.gameId) return

    const command = await this.menu.gameCommand()
    const result = this.actionSelector.parseCommand(command)

    if (!result) {
      await this.handleIdle()
      return
    }

    if (result.action === 'quit') {
      this.cleanup()
      return
    }

    const isMyTurn = this.gameState && this.isMyTurn(this.gameState)

    if (result.action === 'help') {
      this.actionSelector.showHelp()
    } else if (result.action === 'next' || result.action === 'next_hand') {
      if (this.gameState?.currentRound === 'showdown') {
        await this.nextHand()
      } else if (isMyTurn) {
        await this.handleTurn()
        return
      } else {
        this.display.printError('Not your turn. Wait for other players to act.')
      }
    } else if (result.action === 'actions') {
      await this.showActions()
    } else if (result.action === 'advance') {
      await this.advanceRound()
    } else if (result.action === 'refresh') {
      await this.refreshState()
    } else {
      if (isMyTurn) {
        await this.performAction(result.action, result.amount)
      } else {
        this.display.printError('Not your turn. Wait for other players to act.')
      }
    }

    await this.handleIdle()
  }

  private async fetchValidActions(): Promise<void> {
    if (!this.gameId) return

    try {
      this.validActions = await this.api.getValidActions(this.gameId)
      this.display.printActions(this.validActions)
    } catch (err) {
      this.display.printError(`Failed to fetch valid actions: ${(err as Error).message}`)
    }
  }

  private async showActions(): Promise<void> {
    if (!this.gameId) return

    try {
      const actions = await this.api.getValidActions(this.gameId)
      this.display.printActionsFull(actions)
    } catch (err) {
      this.display.printError(`Failed to fetch actions: ${(err as Error).message}`)
    }
  }

  private async performAction(action: string, amount?: number): Promise<void> {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.performAction(this.gameId, action, amount)
      this.validActions = null
      this.display.printGameState(this.gameState, this.playerName)
    } catch (err) {
      this.display.printError(`Action failed: ${(err as Error).message}`)
    }
  }

  private async nextHand(): Promise<void> {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.nextHand(this.gameId)
      this.display.printGameState(this.gameState, this.playerName)
    } catch (err) {
      this.display.printError(`Failed to start next hand: ${(err as Error).message}`)
    }
  }

  private async advanceRound(): Promise<void> {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.advanceRound(this.gameId)
      this.display.printGameState(this.gameState, this.playerName)
    } catch (err) {
      this.display.printError(`Failed to advance round: ${(err as Error).message}`)
    }
  }

  private async refreshState(): Promise<void> {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.getGameState(this.gameId)
      this.display.printGameState(this.gameState, this.playerName)
    } catch (err) {
      this.display.printError(`Failed to refresh state: ${(err as Error).message}`)
    }
  }

  private connectWebSocket(): void {
    if (!this.gameId) return

    this.ws = new WsClient(createWsUrl(BACKEND_LOCAL_PORT))
    this.ws.setHandlers({
      onOpen: () => {
        console.log('WebSocket connected')
        this.ws?.subscribe(
          this.roomCode,
          'player',
          String(this.gameId!),
          this.playerId || undefined,
          this.api.getToken() || undefined,
        )
      },
      onClose: () => {
        console.log('WebSocket disconnected (will auto-reconnect)')
      },
      onGameState: (state) => {
        this.gameState = state
        this.display.printGameState(state, this.playerName)
        if (state.status === 'active' && this.isMyTurn(state) && !this.isHandlingTurn) {
          this.handleTurn()
        }
      },
      onError: (error) => console.error('WebSocket error:', error),
    })

    this.ws.connect(
      this.roomCode,
      'player',
      String(this.gameId),
      this.playerId,
      this.api.getToken() || undefined,
    )
  }

  private isMyTurn(state: GameState): boolean {
    if (!this.playerName) return false
    const me = state.players.find((p) => p.name === this.playerName)
    return (
      !!me &&
      state.status === 'active' &&
      state.currentPlayerPosition !== null &&
      state.currentPlayerPosition === me.position
    )
  }

  private validActions: ValidActions | null = null

  private cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.gameState = null
    this.validActions = null
    this.isHandlingTurn = false
    sessionStorage.clear()
  }
}
