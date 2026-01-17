import { describe, it, expect } from 'bun:test'
import { deriveGameState, type GameConfig, type PlayerConfig } from '../lib/state-derivation'
import { EVENT_TYPES } from '@holdem/shared'
import type { GameEvent } from '../services/event-store'

const mockConfig: GameConfig = {
  smallBlind: 10,
  bigBlind: 20,
  startingChips: 1000,
}

const mockPlayers: PlayerConfig[] = []

describe('State Derivation Engine', () => {
  it('should handle player joining', () => {
    const events: GameEvent[] = [
      {
        id: 1,
        gameId: 1,
        handNumber: 0,
        sequenceNumber: 1,
        eventType: EVENT_TYPES.PLAYER_JOINED,
        playerId: 101,
        payload: { name: 'Alice', position: 0, startingChips: 1000 },
        createdAt: new Date(),
      },
      {
        id: 2,
        gameId: 1,
        handNumber: 0,
        sequenceNumber: 2,
        eventType: EVENT_TYPES.PLAYER_JOINED,
        playerId: 102,
        payload: { name: 'Bob', position: 1, startingChips: 1000 },
        createdAt: new Date(),
      },
    ]

    const state = deriveGameState(mockConfig, mockPlayers, events)

    expect(state.players.length).toBe(2)
    expect(state.players[0].name).toBe('Alice')
    expect(state.players[1].name).toBe('Bob')
    expect(state.players[0].chips).toBe(1000)
  })

  it('should handle hand start and blinds', () => {
    const events: GameEvent[] = [
      {
        id: 1,
        gameId: 1,
        handNumber: 0,
        sequenceNumber: 1,
        eventType: EVENT_TYPES.PLAYER_JOINED,
        playerId: 101,
        payload: { name: 'Alice', position: 0, startingChips: 1000 },
        createdAt: new Date(),
      },
      {
        id: 2,
        gameId: 1,
        handNumber: 0,
        sequenceNumber: 2,
        eventType: EVENT_TYPES.PLAYER_JOINED,
        playerId: 102,
        payload: { name: 'Bob', position: 1, startingChips: 1000 },
        createdAt: new Date(),
      },
      {
        id: 3,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 3,
        eventType: EVENT_TYPES.HAND_START,
        // @ts-ignore
        payload: {
          handNumber: 1,
          dealerPosition: 0,
          smallBlindPosition: 0,
          bigBlindPosition: 1,
          deck: [],
          holeCards: { 101: [], 102: [] },
        },
        createdAt: new Date(),
      },
      {
        id: 4,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 4,
        eventType: EVENT_TYPES.POST_BLIND,
        playerId: 101,
        payload: { blindType: 'small', amount: 10, isAllIn: false },
        createdAt: new Date(),
      },
      {
        id: 5,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 5,
        eventType: EVENT_TYPES.POST_BLIND,
        playerId: 102,
        payload: { blindType: 'big', amount: 20, isAllIn: false },
        createdAt: new Date(),
      },
    ]

    const state = deriveGameState(mockConfig, mockPlayers, events)

    expect(state.handNumber).toBe(1)
    expect(state.pot).toBe(30)
    expect(state.players[0].chips).toBe(990)
    expect(state.players[1].chips).toBe(980)
    expect(state.currentBet).toBe(20)
  })

  it('should handle betting and calling (calculating call amount)', () => {
    // Setup generic initial events
    const baseEvents: GameEvent[] = [
      {
        id: 1,
        gameId: 1,
        handNumber: 0,
        sequenceNumber: 1,
        eventType: EVENT_TYPES.PLAYER_JOINED,
        playerId: 101,
        payload: { name: 'Alice', position: 0, startingChips: 1000 },
        createdAt: new Date(),
      },
      {
        id: 2,
        gameId: 1,
        handNumber: 0,
        sequenceNumber: 2,
        eventType: EVENT_TYPES.PLAYER_JOINED,
        playerId: 102,
        payload: { name: 'Bob', position: 1, startingChips: 1000 },
        createdAt: new Date(),
      },
      {
        id: 3,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 3,
        eventType: EVENT_TYPES.HAND_START,
        // @ts-ignore
        payload: {
          handNumber: 1,
          dealerPosition: 0,
          smallBlindPosition: 0,
          bigBlindPosition: 1,
          deck: [],
          holeCards: { 101: [], 102: [] },
        },
        createdAt: new Date(),
      },
      {
        id: 4,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 4,
        eventType: EVENT_TYPES.POST_BLIND,
        playerId: 101,
        payload: { blindType: 'small', amount: 10, isAllIn: false },
        createdAt: new Date(),
      },
      {
        id: 5,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 5,
        eventType: EVENT_TYPES.POST_BLIND,
        playerId: 102,
        payload: { blindType: 'big', amount: 20, isAllIn: false },
        createdAt: new Date(),
      },
    ]

    const playEvents: GameEvent[] = [
      // Alice calls (match 20)
      {
        id: 6,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 6,
        eventType: EVENT_TYPES.CALL,
        playerId: 101,
        payload: { amount: 0, isAllIn: false },
        createdAt: new Date(),
      },
      // Bob checks
      {
        id: 7,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 7,
        eventType: EVENT_TYPES.CHECK,
        playerId: 102,
        payload: { amount: 0 },
        createdAt: new Date(),
      },
      // Flop dealt
      {
        id: 8,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 8,
        eventType: EVENT_TYPES.DEAL_COMMUNITY,
        payload: { round: 'flop', communityCards: [{ rank: 'A', suit: 'hearts', value: 14 }] },
        createdAt: new Date(),
      },
      // Alice bets 50
      {
        id: 9,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 9,
        eventType: EVENT_TYPES.BET,
        playerId: 101,
        payload: { amount: 50 },
        createdAt: new Date(),
      },
      // Bob raises to 150 (amount=100 in payload usually? or total? Let's assume payload is the RAISE amount like existing logic)
      // Actually handler says key is raise amount.
      {
        id: 10,
        gameId: 1,
        handNumber: 1,
        sequenceNumber: 10,
        eventType: EVENT_TYPES.RAISE,
        playerId: 102,
        payload: { amount: 100 },
        createdAt: new Date(),
      },
    ]

    const state = deriveGameState(mockConfig, mockPlayers, [...baseEvents, ...playEvents])

    // Alice Call: 10 existing + 10 call = 20. Chips: 990 - 10 = 980
    // Pot: 30 + 10 = 40.
    // Flop: pot 40.
    // Alice Bet 50. Chips: 980 - 50 = 930. Pot: 40 + 50 = 90. CurrentBet: 50.
    // Bob Raise 100. Call 50 first. Total added = 50 + 100 = 150.
    // Bob Chips: 980 - 150 = 830.
    // Bob CurrentBet: 0 (reset on flop) + 150 = 150.
    // Pot: 90 + 150 = 240.

    expect(state.players[0].chips).toBe(930) // Alice
    expect(state.players[1].chips).toBe(830) // Bob
    expect(state.pot).toBe(240)
    expect(state.currentBet).toBe(150)
    expect(state.currentRound).toBe('flop')
  })
})
