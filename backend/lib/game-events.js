/**
 * Game Events - Internal event bus for game state changes
 * Enables WebSocket server to broadcast updates without tight coupling
 */

const EventEmitter = require('events');

class GameEvents extends EventEmitter {
  /**
   * Emit a game state update event
   * @param {string} gameId - Game ID
   * @param {string} reason - Reason for update (action, advance, reveal, next_hand, admin)
   */
  emitGameUpdate(gameId, reason = 'update') {
    this.emit('game:updated', { gameId, reason });
  }

  /**
   * Subscribe to game updates
   * @param {Function} handler - Handler function(data)
   */
  onGameUpdate(handler) {
    this.on('game:updated', handler);
  }
}

// Singleton instance
const gameEvents = new GameEvents();

module.exports = gameEvents;
