import { api, ApiClient } from './api-client'
import { WsClient, createWsUrl } from './ws-client'
import type { GameState, ValidActions, Player, Pot } from './types'
import inquirer from 'inquirer'

const BACKEND_PORT = 3660

export interface TerminalOptions {
  port?: number
  baseUrl?: string
}

export class PokerTerminal {
  private api: ApiClient
  private ws: WsClient | null = null
  private gameId: number | null = null
  private roomCode: string = ''
  private playerName: string = ''
  private playerId: string = ''
  private gameState: GameState | null = null
  private validActions: ValidActions | null = null
  private autoRefresh = false
  private refreshInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: TerminalOptions = {}) {
    this.api = new ApiClient({
      baseUrl: options.baseUrl || `http://localhost:${options.port || BACKEND_PORT}`,
    })
  }

  async start() {
    console.clear()
    this.printWelcome()

    const mainMenu = async () => {
      while (true) {
        const { choice } = await inquirer.prompt({
          type: 'list',
          name: 'choice',
          message: 'Main Menu',
          choices: [
            { name: 'Create new game', value: '1' },
            { name: 'Join existing game', value: '2' },
            { name: 'View table state (no auth)', value: '3' },
            { name: 'Exit', value: '0' },
          ],
        })

        switch (choice) {
          case '1':
            await this.createGameMenu()
            break
          case '2':
            await this.joinGameMenu()
            break
          case '3':
            await this.viewTableMenu()
            break
          case '0':
            this.cleanup()
            return
        }
      }
    }

    await mainMenu()
  }

  private printWelcome() {
    console.log('╔══════════════════════════════════════╗')
    console.log("║      Texas Hold'em Terminal Client    ║")
    console.log('╚══════════════════════════════════════╝')
  }

  private async createGameMenu() {
    console.log('\n=== Create New Game ===')

    const { bigBlind, startingChips } = await inquirer.prompt([
      {
        type: 'input',
        name: 'bigBlind',
        message: 'Big blind amount:',
        default: '10',
        validate: (input: string) => {
          const val = parseInt(input)
          return !isNaN(val) && val > 0 ? true : 'Enter a valid number'
        },
      },
      {
        type: 'input',
        name: 'startingChips',
        message: 'Starting chips:',
        default: '1000',
        validate: (input: string) => {
          const val = parseInt(input)
          return !isNaN(val) && val > 0 ? true : 'Enter a valid number'
        },
      },
    ])

    try {
      const smallBlind = Math.floor(bigBlind / 2)
      const result = await this.api.createGame(smallBlind, bigBlind, startingChips)
      console.log(`\n✓ Game created! Room code: ${result.roomCode}`)
      console.log(`  Game ID: ${result.id}`)

      this.roomCode = result.roomCode
      this.gameId = result.id

      const { join } = await inquirer.prompt({
        type: 'confirm',
        name: 'join',
        message: 'Join this game as a player?',
        default: true,
      })

      if (join) {
        await this.joinExistingGame(result.id, result.roomCode)
      }
    } catch (err) {
      console.error('Failed to create game:', (err as Error).message)
    }
  }

  private async joinGameMenu() {
    console.log('\n=== Join Existing Game ===')

    const { roomCode } = await inquirer.prompt({
      type: 'input',
      name: 'roomCode',
      message: 'Enter room code:',
      validate: (input: string) => {
        return input.trim().length > 0 ? true : 'Room code required'
      },
    })

    try {
      const game = await this.api.getGameByRoomCode(roomCode)
      if (!game) {
        console.log('Game not found')
        return
      }

      this.roomCode = roomCode
      this.gameId = game.id
      await this.joinExistingGame(game.id, roomCode)
    } catch (err) {
      console.error('Failed to get game:', (err as Error).message)
    }
  }

  private async joinExistingGame(gameId: number, roomCode: string) {
    console.log(`\nJoining game ${roomCode}...`)

    const { name, password } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter your name:',
        validate: (input: string) => {
          return input.trim().length > 0 ? true : 'Name required'
        },
      },
      {
        type: 'input',
        name: 'password',
        message: 'Enter game password:',
        validate: (input: string) => {
          return input.length >= 4 ? true : 'Password must be at least 4 characters'
        },
      },
    ])

    try {
      const joinResult = await this.api.joinGame(gameId, name, password)
      this.playerName = name

      const state = await this.api.getGameState(gameId)
      const me = state.players.find((p: Player) => p.name === name)
      if (me) {
        this.playerId = me.id
      }

      this.gameState = state
      this.gameId = gameId
      this.roomCode = roomCode

      console.log(`\n✓ Joined game as ${name}`)
      await this.gameLoop()
    } catch (err) {
      console.error('Failed to join game:', (err as Error).message)
    }
  }

  private async viewTableMenu() {
    console.log('\n=== View Table State ===')

    const { roomCode } = await inquirer.prompt({
      type: 'input',
      name: 'roomCode',
      message: 'Enter room code:',
      validate: (input: string) => {
        return input.trim().length > 0 ? true : 'Room code required'
      },
    })

    this.roomCode = roomCode

    try {
      const game = await this.api.getGameByRoomCode(roomCode)
      if (!game) {
        console.log('Game not found')
        return
      }

      this.gameId = game.id
      await this.tableViewLoop()
    } catch (err) {
      console.error('Failed to get game:', (err as Error).message)
    }
  }

  private async tableViewLoop() {
    if (!this.gameId) return

    this.ws = new WsClient(createWsUrl(BACKEND_PORT))
    this.ws.setHandlers({
      onOpen: () => console.log('WebSocket connected'),
      onClose: () => console.log('WebSocket disconnected'),
      onGameState: (state) => {
        this.gameState = state
        this.displayTableState()
      },
      onError: (error) => console.error('WebSocket error:', error),
    })

    this.ws.connect(this.roomCode, 'table', String(this.gameId))

    console.log('\n=== Table View Mode ===')

    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: 'Options',
      choices: [
        { name: 'Refresh', value: 'refresh' },
        { name: 'Toggle auto-refresh (every 2s)', value: 'toggle' },
        { name: 'Quit', value: 'quit' },
      ],
    })

    if (action === 'quit') {
      this.cleanup()
    } else if (action === 'toggle') {
      this.toggleAutoRefresh()
      await this.tableViewLoop()
    } else {
      try {
        const state = await this.api.getGameState(this.gameId!)
        this.gameState = state
        this.displayTableState()
      } catch (err) {
        console.error('Failed to refresh:', (err as Error).message)
      }
      await this.tableViewLoop()
    }
  }

  private toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh
    if (this.autoRefresh) {
      console.log('Auto-refresh enabled (every 2 seconds)')
      this.refreshInterval = setInterval(async () => {
        if (this.gameId) {
          try {
            const state = await this.api.getGameState(this.gameId)
            this.gameState = state
            this.displayTableState()
          } catch (err) {}
        }
      }, 2000)
    } else {
      console.log('Auto-refresh disabled')
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval)
        this.refreshInterval = null
      }
    }
  }

  private async gameLoop() {
    if (!this.gameId) return

    this.connectWebSocket()

    console.log('\n=== Game Active ===')
    console.log('')

    if (this.gameState && this.isMyTurn(this.gameState) && this.validActions) {
      await this.selectAction()
    } else {
      const { command } = await inquirer.prompt({
        type: 'input',
        name: 'command',
        message: 'Command (actions, refresh, next, advance, quit):',
      })

      const lowerInput = command.toLowerCase().trim()

      if (lowerInput === 'quit' || lowerInput === 'q') {
        this.cleanup()
        return
      }

      if (lowerInput === 'actions' || lowerInput === 'a') {
        await this.showActions()
      } else if (lowerInput === 'next' || lowerInput === 'n') {
        await this.nextHand()
      } else if (lowerInput === 'advance') {
        await this.advanceRound()
      } else if (lowerInput === 'refresh' || lowerInput === 'r') {
        await this.refreshState()
      } else {
        console.log('Unknown command.')
      }

      await this.gameLoop()
    }
  }

  private async selectAction() {
    if (!this.validActions) return

    const choices: { name: string; value: string }[] = []

    if (this.validActions.canCheck) {
      choices.push({ name: 'Check', value: 'check' })
    }
    if (this.validActions.canCall) {
      const amount = this.validActions.callAmount || 0
      choices.push({ name: `Call ($${amount})`, value: 'call' })
    }
    if (this.validActions.canBet) {
      const min = this.validActions.minBet || 0
      const max = this.validActions.maxBet || 0
      choices.push({ name: `Bet ($${min}-$${max})`, value: 'bet' })
    }
    if (this.validActions.canRaise) {
      const min = this.validActions.minRaise || 0
      const max = this.validActions.maxRaise || 0
      choices.push({ name: `Raise ($${min}-$${max})`, value: 'raise' })
    }
    if (this.validActions.canFold) {
      choices.push({ name: 'Fold', value: 'fold' })
    }

    choices.push({ name: 'Refresh actions', value: 'refresh' })
    choices.push({ name: 'Back', value: 'back' })

    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: "It's your turn!",
      choices,
    })

    if (action === 'back') {
      await this.gameLoop()
      return
    }

    if (action === 'refresh') {
      await this.fetchValidActions()
      await this.selectAction()
      return
    }

    if (action === 'bet' || action === 'raise') {
      const { amount } = await inquirer.prompt({
        type: 'input',
        name: 'amount',
        message: `Enter ${action} amount:`,
        validate: (input: string) => {
          const val = parseInt(input)
          if (isNaN(val) || val <= 0) return 'Enter a valid amount'
          return true
        },
      })
      await this.performAction(action, parseInt(amount))
    } else {
      await this.performAction(action)
    }

    await this.gameLoop()
  }

  private connectWebSocket() {
    if (!this.gameId) return

    this.ws = new WsClient(createWsUrl(BACKEND_PORT))
    this.ws.setHandlers({
      onOpen: () => {
        console.log('WebSocket connected')
        this.ws?.subscribe(
          this.roomCode,
          'player',
          String(this.gameId!),
          this.playerId || undefined,
        )
      },
      onClose: () => {
        console.log('WebSocket disconnected (will auto-reconnect)')
      },
      onGameState: (state, reason) => {
        this.gameState = state
        this.displayGameState()
        if (state.status === 'active' && this.isMyTurn(state)) {
          this.fetchValidActions()
        }
      },
      onError: (error) => console.error('WebSocket error:', error),
    })

    this.ws.connect(this.roomCode, 'player', String(this.gameId), this.playerId)
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

  private async fetchValidActions() {
    if (!this.gameId) return

    try {
      this.validActions = await this.api.getValidActions(this.gameId)
    } catch (err) {
      console.error('Failed to fetch valid actions:', (err as Error).message)
    }
  }

  private async showActions() {
    if (!this.gameId) return

    try {
      const actions = await this.api.getValidActions(this.gameId)
      this.displayActionsFull(actions)
    } catch (err) {
      console.error('Failed to fetch actions:', (err as Error).message)
    }
  }

  private displayActionsFull(actions: ValidActions) {
    console.log('\n=== Valid Actions ===')
    console.log(`Can act: ${actions.canAct}`)
    console.log(`Can fold: ${actions.canFold}`)
    console.log(`Can check: ${actions.canCheck}`)
    console.log(
      `Can call: ${actions.canCall}${actions.callAmount !== undefined ? ` ($${actions.callAmount})` : ''}`,
    )
    console.log(
      `Can bet: ${actions.canBet}${actions.minBet !== undefined ? ` (min: $${actions.minBet}, max: $${actions.maxBet})` : ''}`,
    )
    console.log(
      `Can raise: ${actions.canRaise}${actions.minRaise !== undefined ? ` (min: $${actions.minRaise}, max: $${actions.maxRaise})` : ''}`,
    )
    if (actions.reason) {
      console.log(`Note: ${actions.reason}`)
    }
  }

  private displayActions() {
    if (!this.validActions) return

    console.log("\n=== It's Your Turn! ===")
    const actions: string[] = []

    if (this.validActions.canCheck) actions.push('[check]')
    if (this.validActions.canCall) actions.push(`[call $${this.validActions.callAmount || 0}]`)
    if (this.validActions.canBet)
      actions.push(`[bet $${this.validActions.minBet}-${this.validActions.maxBet}]`)
    if (this.validActions.canRaise)
      actions.push(`[raise $${this.validActions.minRaise}-${this.validActions.maxRaise}]`)
    if (this.validActions.canFold) actions.push('[fold]')

    if (this.validActions.reason) {
      console.log(`Status: ${this.validActions.reason}`)
    }

    console.log('Actions: ' + actions.join(' '))
  }

  private async performAction(action: string, amount?: number) {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.performAction(this.gameId, action, amount)
      this.validActions = null
      this.displayGameState()
    } catch (err) {
      console.error(`Action failed: ${(err as Error).message}`)
    }
  }

  private async nextHand() {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.nextHand(this.gameId)
      this.displayGameState()
    } catch (err) {
      console.error(`Failed to start next hand: ${(err as Error).message}`)
    }
  }

  private async advanceRound() {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.advanceRound(this.gameId)
      this.displayGameState()
    } catch (err) {
      console.error(`Failed to advance round: ${(err as Error).message}`)
    }
  }

  private async refreshState() {
    if (!this.gameId) return

    try {
      this.gameState = await this.api.getGameState(this.gameId)
      this.displayGameState()
    } catch (err) {
      console.error(`Failed to refresh state: ${(err as Error).message}`)
    }
  }

  private displayGameState() {
    if (!this.gameState) return

    console.clear()
    this.printWelcome()
    this.displayTableState()

    if (this.gameState.status === 'active') {
      const me = this.gameState.players.find((p) => p.name === this.playerName)
      if (me) {
        console.log(`\nYour chips: $${me.chips}`)
        console.log(`Your current bet: $${me.currentBet}`)
        const cards = me.holeCards
        if (cards && cards.length > 0) {
          console.log(
            `Your cards: ${cards.map((c) => `${c.rank}${c.suit?.[0]?.toUpperCase() ?? '?'}`).join(' ')}`,
          )
        }

        if (this.isMyTurn(this.gameState)) {
          console.log("\n>>> IT'S YOUR TURN <<<")
          if (this.validActions) {
            this.displayActions()
          }
        }
      }
    }
  }

  private displayTableState() {
    if (!this.gameState) {
      console.log('No game state')
      return
    }

    const state = this.gameState

    console.log(
      `\nRoom: ${state.roomCode} | Hand: ${state.handNumber || 1} | Status: ${state.status}`,
    )
    console.log(
      `Round: ${state.currentRound || 'preflop'} | Pot: $${state.pot} | To Call: $${state.currentBet}`,
    )

    if (state.pots && state.pots.length > 1) {
      state.pots.forEach((pot: Pot, idx: number) => {
        console.log(`  ${idx === 0 ? 'Main' : `Side ${idx}`}: $${pot.amount}`)
      })
    }

    if (state.communityCards && state.communityCards.length > 0) {
      console.log(
        `Community: ${state.communityCards.map((c) => `${c.rank}${c.suit?.[0]?.toUpperCase() ?? '?'}`).join(' ')}`,
      )
    }

    console.log('\nPlayers:')
    state.players.forEach((player: Player) => {
      const statusIcon =
        player.status === 'folded'
          ? '✗'
          : player.status === 'all_in'
            ? '⚡'
            : player.status === 'out'
              ? '○'
              : '●'
      const isMe = player.name === this.playerName ? ' (YOU)' : ''
      const isCurrent = state.currentPlayerPosition === player.position ? ' ⬅️' : ''
      console.log(
        `  ${statusIcon} ${player.name}${isMe}: $${player.chips}${isCurrent} [bet: $${player.currentBet}] [${player.status}]`,
      )
    })
  }

  private cleanup() {
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
  }
}

const terminal = new PokerTerminal()
terminal.start().catch(console.error)
