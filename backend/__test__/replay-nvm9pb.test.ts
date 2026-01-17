import { describe, expect, test } from 'bun:test'
import { deriveGameState } from '../lib/state-derivation'
import type { GameEvent } from '../services/event-store'
import fs from 'fs'
import path from 'path'
import { EVENT_TYPES } from '@holdem/shared'

describe('Replay Game NVM9PB', () => {
  const eventsPath = path.join(__dirname, 'fixtures/nvm9pb-events.json')
  const rawEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'))

  // Parse datestrings back to Date objects if needed, though derivation mostly ignores timestamp
  const events: GameEvent[] = rawEvents.map((e: any) => ({
    ...e,
    payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
    timestamp: new Date(e.timestamp),
  }))

  test('should correctly derive final state from full event stream', () => {
    // 1. Extract Config from GAME_CREATED
    const createEvent = events.find((e) => e.eventType === 'GAME_CREATED')
    if (!createEvent) throw new Error('No GAME_CREATED event found')

    const config = {
      smallBlind: createEvent.payload.smallBlind,
      bigBlind: createEvent.payload.bigBlind,
      startingChips: createEvent.payload.startingChips,
    }

    // 2. Extract Players (derived internally by deriveGameState from PLAYER_JOINED,
    // but we need initial empty array)
    const players: any[] = []

    // 3. Run Derivation
    const state = deriveGameState(config, players, events)

    // 4. Verify Final State
    // Hand 4 was the last hand. P62 (bill) raised/bet, P63 (james) called all-in/folded?
    // Let's check the logs. Hand 4: P62 won.
    // Event #71 HAND_COMPLETE winners=[0] (Player 0 is P62).

    // Check Winners
    expect(state.winners).toEqual([0]) // Position 0

    // Check Players Chips
    // Bill (P62, Pos 0) should have all chips?
    // Start 400 each (from logs). Or 600? Log says startingChips:400 in Hand 0.
    // Hand 0 log: "startingChips":400.
    // Wait, Hand 3 events log says "startingChips":600 in ELWAZM, but NVM9PB says 400.
    // NVM9PB Hand 0 log: startingChips:400.
    // So final chips for Bill should be 800. James 0.

    const bill = state.players.find((p) => p.position === 0)!
    const james = state.players.find((p) => p.position === 1)!

    expect(bill.chips).toBe(800)
    expect(james.chips).toBe(0)
    expect(james.status).toBe('all_in') // Remains all_in until next hand start processes elimination

    // Check Hand Number
    expect(state.handNumber).toBe(4) // Last hand was 4?
    // Events log shows Hand 4.
  })
})
