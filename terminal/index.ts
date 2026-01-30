import { api } from './api-client'
import { MenuSystem } from './menu'
import { Display } from './display'
import { ActionSelector } from './action-selector'
import { GameLoop } from './game-loop'
import { sessionStorage } from './session-storage'

class PokerTerminal {
  private api = api
  private menu = new MenuSystem(this.api)
  private display = new Display()
  private actionSelector = new ActionSelector()
  private gameLoop = new GameLoop(this.api, this.menu, this.display, this.actionSelector)

  async start() {
    this.display.printWelcome()

    while (true) {
      const savedSession = sessionStorage.load()
      const choice = await this.menu.mainMenu(
        savedSession
          ? { roomCode: savedSession.roomCode, playerName: savedSession.playerName }
          : undefined,
      )

      switch (choice) {
        case 'reconnect':
          await this.handleReconnect()
          break
        case 'create':
          await this.handleCreateGame()
          break
        case 'join':
          await this.handleJoinGame()
          break
        case 'view':
          await this.handleViewTable()
          break
        case 'exit':
          return
      }
    }
  }

  private async handleCreateGame() {
    console.log('\n=== Create New Game ===')
    const { bigBlind, startingChips } = await this.menu.promptCreateGame()

    try {
      const smallBlind = Math.floor(bigBlind / 2)
      const result = await this.api.createGame(smallBlind, bigBlind, startingChips)
      console.log(`\n✓ Game created! Room code: ${result.roomCode}`)
      console.log(`  Game ID: ${result.id}`)

      const join = await this.menu.confirmJoin()
      if (join) {
        await this.joinExistingGame(result.id, result.roomCode)
      }
    } catch (err) {
      this.display.printError(`Failed to create game: ${(err as Error).message}`)
    }
  }

  private async handleReconnect() {
    const savedSession = sessionStorage.load()
    if (!savedSession) {
      this.display.printError('No saved session found')
      return
    }

    console.log(`\nReconnecting to game ${savedSession.roomCode}...`)

    try {
      const game = await this.api.getGameByRoomCode(savedSession.roomCode)
      if (!game) {
        this.display.printError('Game not found')
        sessionStorage.clear()
        return
      }

      await this.api.joinGame(game.id, savedSession.playerName, savedSession.password)
      await this.gameLoop.run(
        game.id,
        savedSession.roomCode,
        savedSession.playerName,
        savedSession.password,
      )
    } catch (err) {
      this.display.printError(`Failed to reconnect: ${(err as Error).message}`)
      sessionStorage.clear()
    }
  }

  private async handleJoinGame() {
    console.log('\n=== Join Existing Game ===')
    const roomCode = await this.menu.promptRoomCode()

    try {
      const game = await this.api.getGameByRoomCode(roomCode)
      if (!game) {
        console.log('Game not found')
        return
      }
      await this.joinExistingGame(game.id, roomCode)
    } catch (err) {
      this.display.printError(`Failed to get game: ${(err as Error).message}`)
    }
  }

  private async joinExistingGame(gameId: number, roomCode: string) {
    console.log(`\nJoining game ${roomCode}...`)
    const { name, password } = await this.menu.promptPlayerCredentials()

    try {
      await this.api.joinGame(gameId, name, password)
      await this.gameLoop.run(gameId, roomCode.toUpperCase(), name, password)
    } catch (err) {
      this.display.printError(`Failed to join game: ${(err as Error).message}`)
    }
  }

  private async handleViewTable() {
    console.log('\n=== View Table State ===')
    const roomCode = await this.menu.promptRoomCode()

    try {
      const game = await this.api.getGameByRoomCode(roomCode)
      if (!game) {
        console.log('Game not found')
        return
      }
      await this.viewTableLoop(game.id, roomCode)
    } catch (err) {
      this.display.printError(`Failed to get game: ${(err as Error).message}`)
    }
  }

  private async viewTableLoop(gameId: number, roomCode: string) {
    const { WsClient, createWsUrl } = await import('./ws-client')
    const { BACKEND_LOCAL_PORT } = await import('../shared/config')
    const ws = new WsClient(createWsUrl(BACKEND_LOCAL_PORT))
    ws.setHandlers({
      onOpen: () => console.log('WebSocket connected'),
      onClose: () => console.log('WebSocket disconnected'),
      onGameState: (state) => {
        this.display.printTableState(state, '')
      },
      onError: (error) => console.error('WebSocket error:', error),
    })

    ws.connect(
      roomCode.toUpperCase(),
      'table',
      String(gameId),
      '',
      this.api.getToken() || undefined,
    )

    console.log('\n=== Table View Mode ===')
    const action = await this.menu.tableViewOptions()

    if (action === 'quit') {
      ws.close()
      return
    }

    if (action === 'toggle') {
      console.log('Auto-refresh toggled (not implemented in view mode)')
    } else if (action === 'refresh') {
      try {
        const state = await this.api.getGameState(gameId)
        this.display.printTableState(state, '')
      } catch (err) {
        this.display.printError(`Failed to refresh: ${(err as Error).message}`)
      }
    }

    await this.viewTableLoop(gameId, roomCode)
  }
}

const terminal = new PokerTerminal()
terminal.start().catch(console.error)
