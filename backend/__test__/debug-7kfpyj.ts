import { deriveGameState } from '../lib/state-derivation'
import type { GameEvent } from '../services/event-store'
import fs from 'fs'
import path from 'path'

const eventsPath = path.join(__dirname, 'fixtures/7kfpyj-events.json')
const rawEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'))

const events: GameEvent[] = rawEvents.map((e: any) => ({
  ...e,
  payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
  timestamp: new Date(e.timestamp),
}))

const config = { smallBlind: 10, bigBlind: 20, startingChips: 600 }
const state = deriveGameState(config, [], events)

console.log('Hand:', state.handNumber)
console.log('Status:', state.status)
console.log('isGameOver:', state.isGameOver)
console.log('Players:')
state.players.forEach((p) => console.log('  -', p.name, 'chips:', p.chips, 'status:', p.status))
