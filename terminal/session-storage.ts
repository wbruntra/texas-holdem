import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'

export type SavedSession = {
  roomCode: string
  playerName: string
  password: string
  gameId: number
  savedAt: string
}

export class SessionStorage {
  private filePath = join(__dirname, '.last-session.json')

  save(session: Omit<SavedSession, 'savedAt'>): void {
    try {
      const data: SavedSession = {
        ...session,
        savedAt: new Date().toISOString(),
      }
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save session:', (err as Error).message)
    }
  }

  load(): SavedSession | null {
    try {
      if (!this.exists()) {
        return null
      }
      const content = readFileSync(this.filePath, 'utf-8')
      return JSON.parse(content) as SavedSession
    } catch (err) {
      this.clear()
      return null
    }
  }

  clear(): void {
    try {
      if (this.exists()) {
        unlinkSync(this.filePath)
      }
    } catch (err) {
      console.error('Failed to clear session:', (err as Error).message)
    }
  }

  exists(): boolean {
    return existsSync(this.filePath)
  }
}

export const sessionStorage = new SessionStorage()
