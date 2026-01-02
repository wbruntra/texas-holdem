/**
 * Event Logger - Centralized logging service for end-to-end testing
 * Captures all game events when LOG_EVENTS environment variable is true
 */

const fs = require('fs')
const path = require('path')
const { EVENT_TYPE } = require('../lib/event-types')

class EventLogger {
  constructor() {
    this.enabled = process.env.LOG_EVENTS === 'true'
    this.events = []
    this.logFilePath = path.join(__dirname, '../../event-log.json')
    this.autoFlush = true // Auto-flush after each event

    if (this.enabled) {
      console.log('[EventLogger] Logging enabled - events will be written to', this.logFilePath)
      this.initializeLogFile()
    }
  }

  /**
   * Initialize/clear the log file
   */
  initializeLogFile() {
    try {
      fs.writeFileSync(this.logFilePath, JSON.stringify([], null, 2))
    } catch (error) {
      console.error('[EventLogger] Failed to initialize log file:', error)
    }
  }

  /**
   * Log an event
   * @param {string} eventType - Event type from EVENT_TYPE constants
   * @param {Object} data - Event data
   * @param {string} gameId - Game ID (optional)
   */
  logEvent(eventType, data = {}, gameId = null) {
    if (!this.enabled) return

    const event = {
      timestamp: new Date().toISOString(),
      eventType,
      gameId,
      data,
      sequence: this.events.length,
    }

    this.events.push(event)

    if (this.autoFlush) {
      this.flushToFile()
    }

    // Also log to console for real-time debugging
    console.log(
      `[Event:${event.sequence}] ${eventType}`,
      gameId ? `[Game:${gameId}]` : '',
      JSON.stringify(data),
    )
  }

  /**
   * Flush events to file
   */
  flushToFile() {
    if (!this.enabled) return

    try {
      fs.writeFileSync(this.logFilePath, JSON.stringify(this.events, null, 2))
    } catch (error) {
      console.error('[EventLogger] Failed to write log file:', error)
    }
  }

  /**
   * Get all logged events
   */
  getEvents() {
    return this.events
  }

  /**
   * Get events for a specific game
   */
  getGameEvents(gameId) {
    return this.events.filter((e) => e.gameId === gameId)
  }

  /**
   * Clear all events
   */
  clear() {
    this.events = []
    if (this.enabled) {
      this.initializeLogFile()
    }
  }

  /**
   * Export events to a file
   */
  exportToFile(filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.events, null, 2))
      return true
    } catch (error) {
      console.error('[EventLogger] Failed to export events:', error)
      return false
    }
  }
}

// Singleton instance
const eventLogger = new EventLogger()

module.exports = eventLogger
