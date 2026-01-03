import { EventEmitter } from 'events'

interface GameUpdateData {
  gameId: string
  reason: string
}

class GameEvents extends EventEmitter {
  emitGameUpdate(gameId: string, reason: string = 'update'): void {
    this.emit('game:updated', { gameId, reason })
  }

  onGameUpdate(handler: (data: GameUpdateData) => void): void {
    this.on('game:updated', handler)
  }
}

const gameEvents = new GameEvents()

export default gameEvents
