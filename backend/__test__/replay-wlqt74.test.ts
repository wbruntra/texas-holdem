import { describe, expect, test } from 'bun:test'
import { deriveGameState } from '@holdem/shared/state-derivation'
import type { GameEvent } from '@holdem/shared/event-types'
import fs from 'fs'
import path from 'path'

describe('Replay Game WLQT74', () => {
  const eventsPath = path.join(__dirname, 'fixtures/wlqt74-events.json')
  const rawEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'))

  const events: GameEvent[] = rawEvents.map((e: any) => ({
    ...e,
    payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
    timestamp: new Date(e.timestamp),
  }))

  test('should correctly derive state after each hand', () => {
    const config = {
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 200,
    }

    const currentEvents: GameEvent[] = []

    // Hand 1
    const hand1Events = events.filter((e) => e.handNumber <= 1)
    const state1 = deriveGameState(config, [], hand1Events)
    expect(state1.handNumber).toBe(1)

    // Hand 1 results: James won 100 pot.
    // Bill spent 50 (5+5+20+20). James spent 50.
    // Bill: 200 - 50 = 150. James: 200 - 50 + 100 = 250.
    const bill1 = state1.players.find((p) => p.name === 'bill')!
    const james1 = state1.players.find((p) => p.name === 'james')!
    expect(bill1.chips).toBe(150)
    expect(james1.chips).toBe(250)

    // Hand 2
    const hand2Events = events.filter((e) => e.handNumber <= 2)
    const state2 = deriveGameState(config, [], hand2Events)
    expect(state2.handNumber).toBe(2)

    // Hand 2 results: James won 200 pot. Bill folded.
    // Bill spent 80 (10+10+20+40). James spent 80? (5+15+20+40).
    // Wait, James also bet 40 on river that Bill folded to.
    // James total spent: 5+15+20+40+40 = 120.
    // James: 250 - 120 + 200 = 330.
    // Bill: 150 - 80 = 70.
    const bill2 = state2.players.find((p) => p.name === 'bill')!
    const james2 = state2.players.find((p) => p.name === 'james')!
    expect(bill2.chips).toBe(70)
    expect(james2.chips).toBe(330)

    // Hand 3
    const hand3Events = events.filter((e) => e.handNumber <= 3)
    const state3 = deriveGameState(config, [], hand3Events)
    expect(state3.handNumber).toBe(3)

    // Hand 3 results: Bill won 140 pot. Bill all-in.
    // Bill spent 70. James spent 70.
    // Bill: 70 - 70 + 140 = 140.
    // James: 330 - 70 = 260.
    const bill3 = state3.players.find((p) => p.name === 'bill')!
    const james3 = state3.players.find((p) => p.name === 'james')!
    expect(bill3.chips).toBe(140)
    expect(james3.chips).toBe(260)

    // Hand 4 (Final)
    const hand4Events = events.filter((e) => e.handNumber <= 4)
    const state4 = deriveGameState(config, [], hand4Events)
    expect(state4.handNumber).toBe(4)

    // Hand 4 results: James won 400 pot. Bill all-in.
    // James starts with 260.
    // James: 260 - 200 (all in?) + 400 = 460? Wait.
    // Total chips in hand was 400. James wins all.
    const bill4 = state4.players.find((p) => p.name === 'bill')!
    const james4 = state4.players.find((p) => p.name === 'james')!
    expect(bill4.chips).toBe(0)
    expect(james4.chips).toBe(400) // Total remains 400
  })

  test('should satisfy conservation of chips invariant after every hand', () => {
    const config = {
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 200,
    }
    const INITIAL_TOTAL_CHIPS = 400

    // We check the state after every event to ensures chips are never lost or created
    let state = deriveGameState(config, [], [])

    // We can iterate through hand by hand to make it cleaner
    const maxHands = Math.max(...events.map((e) => e.handNumber))

    for (let h = 1; h <= maxHands; h++) {
      const handEvents = events.filter((e) => e.handNumber <= h)
      state = deriveGameState(config, [], handEvents)

      const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0)
      const chipsInPot = (state.pots || []).reduce((sum, pot) => sum + pot.amount, 0)
      const chipsOnTable = state.players.reduce((sum, p) => sum + (p.currentBet || 0), 0)

      // Total chips (in stacks + in pots + current bets) must equal INITIAL_TOTAL_CHIPS
      expect(totalChips + chipsInPot + chipsOnTable).toBe(INITIAL_TOTAL_CHIPS)

      // Specifically after a hand is complete, pot and current bets should be 0
      const isHandComplete = handEvents[handEvents.length - 1].eventType === 'HAND_COMPLETE'
      if (isHandComplete) {
        expect(chipsInPot).toBe(0)
        expect(chipsOnTable).toBe(0)
        expect(totalChips).toBe(INITIAL_TOTAL_CHIPS)
      }
    }
  })

  test('should have correct player counts and names', () => {
    const config = {
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 200,
    }
    const state = deriveGameState(config, [], events)

    expect(state.players).toHaveLength(2)
    expect(state.players.map((p) => p.name)).toContain('bill')
    expect(state.players.map((p) => p.name)).toContain('james')
  })
})
