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

export class EventLogger {
  private enabled: boolean
  private events: LoggedEvent[]
  private logFilePath: string
  private autoFlush: boolean
  private writeQueue: Promise<void>

  constructor() {
    this.enabled = process.env.LOG_EVENTS === 'true'
    this.events = []
    this.logFilePath = path.join(__dirname, '../../event-log.jsonl')
    this.autoFlush = true
    this.writeQueue = Promise.resolve()

    if (this.enabled) {
      console.log('[EventLogger] Logging enabled - events will be written to', this.logFilePath)
      this.loadFromFile()
    }
  }

  /**
   * Load events from log file
   */
  loadFromFile(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const fileContent = fs.readFileSync(this.logFilePath, 'utf-8')
        if (fileContent) {
          this.events = fileContent
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        }
      }
    } catch (error) {
      console.error('[EventLogger] Failed to load log file:', error)
    }
  }

  /**
   * Initialize empty log file
   */
  initializeLogFile(): void {
    try {
      fs.writeFileSync(this.logFilePath, '')
    } catch (error) {
      console.error('[EventLogger] Failed to initialize log file:', error)
    }
  }

  /**
   * Log an event with optional game ID and data
   */
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
      this.flushToFile(event)
    }

    console.log(
      `[Event:${event.sequence}] ${eventType}`,
      gameId ? `[Game:${gameId}]` : '',
      JSON.stringify(data),
    )
  }

  /**
   * Write a single event to the log file
   */
  flushToFile(event: LoggedEvent): void {
    if (!this.enabled) return

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fs.promises.appendFile(this.logFilePath, JSON.stringify(event) + '\n')
      } catch (error) {
        console.error('[EventLogger] Failed to write log file:', error)
      }
    })
  }

  /**
   * Get all logged events
   */
  getEvents(): LoggedEvent[] {
    return this.events
  }

  /**
   * Get events for a specific game
   */
  getGameEvents(gameId: string | number): LoggedEvent[] {
    return this.events.filter((e) => e.gameId === gameId)
  }

  /**
   * Clear all events and reset log file
   */
  clear(): void {
    this.events = []
    if (this.enabled) {
      this.initializeLogFile()
    }
  }

  /**
   * Export events to specified file path
   */
  exportToFile(filePath: string): boolean {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.events, null, 2))
      return true
    } catch (error) {
      console.error('[EventLogger] Failed to export events:', error)
      return false
    }
  }

  /**
   * Wait for all pending writes to complete
   * For testing purposes
   */
  async waitForWrites(): Promise<void> {
    await this.writeQueue
  }
}

const eventLogger = new EventLogger()

export default eventLogger
