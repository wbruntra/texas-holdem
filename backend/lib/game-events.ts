import { EventEmitter } from 'events'

interface GameUpdateData {
  gameId: string
  reason: string
}

interface RoomUpdateData {
  roomCode: string
  newGameId: number
  reason: string
}

class GameEvents extends EventEmitter {
  emitGameUpdate(gameId: string, reason: string = 'update'): void {
    this.emit('game:updated', { gameId, reason })
  }

  onGameUpdate(handler: (data: GameUpdateData) => void): void {
    this.on('game:updated', handler)
  }

  // Emit room-level update (for new game creation where gameId changes)
  emitRoomUpdate(roomCode: string, newGameId: number, reason: string = 'new_game'): void {
    this.emit('room:updated', { roomCode, newGameId, reason })
  }

  onRoomUpdate(handler: (data: RoomUpdateData) => void): void {
    this.on('room:updated', handler)
  }
}

const gameEvents = new GameEvents()

export default gameEvents
