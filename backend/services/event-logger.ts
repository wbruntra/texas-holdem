import fs from 'fs'
import path from 'path'
import { EVENT_TYPE, type EventType } from '@/lib/event-types'

interface LoggedEvent {
  timestamp: string
  eventType: EventType
  gameId: string | number | null
  data: Record<string, unknown>
  sequence: number
}

class EventLogger {
  private enabled: boolean
  private events: LoggedEvent[]
  private logFilePath: string
  private autoFlush: boolean

  constructor() {
    this.enabled = process.env.LOG_EVENTS === 'true'
    this.events = []
    this.logFilePath = path.join(__dirname, '../../event-log.json')
    this.autoFlush = true

    if (this.enabled) {
      console.log('[EventLogger] Logging enabled - events will be written to', this.logFilePath)
      this.initializeLogFile()
    }
  }

  initializeLogFile(): void {
    try {
      fs.writeFileSync(this.logFilePath, JSON.stringify([], null, 2))
    } catch (error) {
      console.error('[EventLogger] Failed to initialize log file:', error)
    }
  }

  logEvent(
    eventType: EventType,
    data: Record<string, unknown> = {},
    gameId: string | number | null = null,
  ): void {
    if (!this.enabled) return

    const event: LoggedEvent = {
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

    console.log(
      `[Event:${event.sequence}] ${eventType}`,
      gameId ? `[Game:${gameId}]` : '',
      JSON.stringify(data),
    )
  }

  flushToFile(): void {
    if (!this.enabled) return

    try {
      fs.writeFileSync(this.logFilePath, JSON.stringify(this.events, null, 2))
    } catch (error) {
      console.error('[EventLogger] Failed to write log file:', error)
    }
  }

  getEvents(): LoggedEvent[] {
    return this.events
  }

  getGameEvents(gameId: string | number): LoggedEvent[] {
    return this.events.filter((e) => e.gameId === gameId)
  }

  clear(): void {
    this.events = []
    if (this.enabled) {
      this.initializeLogFile()
    }
  }

  exportToFile(filePath: string): boolean {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.events, null, 2))
      return true
    } catch (error) {
      console.error('[EventLogger] Failed to export events:', error)
      return false
    }
  }
}

const eventLogger = new EventLogger()

export default eventLogger
