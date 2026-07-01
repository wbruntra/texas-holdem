import { describe, it, expect } from 'bun:test'
import bunWsService from '../services/bun-websocket-service'

// Regression: a completed real showdown sets action_finished=true (via the
// HAND_COMPLETE event). The sanitizers must NOT blanket-reveal on that flag —
// only cards flagged showCards during derivation (winners, all-in runouts, or
// voluntary reveals) may be exposed. Losers/callers stay mucked.

function makeShowdownGame() {
  return {
    id: 1,
    roomCode: 'TEST',
    status: 'active',
    smallBlind: 10,
    bigBlind: 20,
    startingChips: 1000,
    dealerPosition: 0,
    currentRound: 'showdown',
    pot: 0,
    pots: [],
    currentBet: 0,
    currentPlayerPosition: null,
    handNumber: 1,
    action_finished: true, // set by HAND_COMPLETE after every showdown
    communityCards: [
      { rank: '2', suit: 'clubs', value: 2 },
      { rank: '7', suit: 'hearts', value: 7 },
      { rank: 'K', suit: 'spades', value: 13 },
      { rank: '9', suit: 'diamonds', value: 9 },
      { rank: '4', suit: 'clubs', value: 4 },
    ],
    winners: [0],
    players: [
      {
        id: 101,
        name: 'Winner',
        position: 0,
        chips: 2000,
        currentBet: 0,
        totalBet: 0,
        status: 'active',
        showCards: true, // winner revealed by handleAwardPot
        holeCards: [
          { rank: 'K', suit: 'hearts', value: 13 },
          { rank: 'K', suit: 'clubs', value: 13 },
        ],
        lastAction: 'call',
        connected: true,
      },
      {
        id: 102,
        name: 'Loser',
        position: 1,
        chips: 0,
        currentBet: 0,
        totalBet: 0,
        status: 'active',
        showCards: false, // loser called; may muck
        holeCards: [
          { rank: 'Q', suit: 'diamonds', value: 12 },
          { rank: 'J', suit: 'spades', value: 11 },
        ],
        lastAction: 'call',
        connected: true,
      },
    ],
  }
}

describe('Showdown muck rule', () => {
  it('table view hides the losing (mucked) hand at a completed showdown', () => {
    const sanitized = bunWsService.sanitizeTableState(makeShowdownGame())

    const winner = sanitized.players.find((p: any) => p.id === 101)
    const loser = sanitized.players.find((p: any) => p.id === 102)

    expect(winner.holeCards.length).toBe(2)
    expect(loser.holeCards.length).toBe(0)
  })

  it('player view hides an opponent that mucked, but the loser still sees their own cards', () => {
    // From the losing player's own perspective
    const ownView = bunWsService.sanitizePlayerState(makeShowdownGame(), 102)
    const loserSelf = ownView.players.find((p: any) => p.id === 102)
    const winnerFromLoser = ownView.players.find((p: any) => p.id === 101)
    expect(loserSelf.holeCards.length).toBe(2) // always sees own cards
    expect(winnerFromLoser.holeCards.length).toBe(2) // winner revealed

    // From the winning player's perspective, the mucked loser stays hidden
    const winnerView = bunWsService.sanitizePlayerState(makeShowdownGame(), 101)
    const loserFromWinner = winnerView.players.find((p: any) => p.id === 102)
    expect(loserFromWinner.holeCards.length).toBe(0)
  })

  it('reveals every hand in an all-in runout (showCards set during derivation)', () => {
    const game = makeShowdownGame()
    // All-in runout marks every participant showCards=true during derivation.
    game.players[1].showCards = true
    const sanitized = bunWsService.sanitizeTableState(game)
    const loser = sanitized.players.find((p: any) => p.id === 102)
    expect(loser.holeCards.length).toBe(2)
  })
})
