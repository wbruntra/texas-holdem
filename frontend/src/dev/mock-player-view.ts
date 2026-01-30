import type {
  Card,
  ApiPlayer as Player,
  ApiGameState as GameState,
  ValidActions,
} from '@holdem/shared/game-types'

type MockPlayerViewState = {
  game: GameState
  validActions: ValidActions | null
  playerName: string
  betAmount: number
  raiseAmount: number
}

const createCard = (rank: Card['rank'], suit: Card['suit'], value: number): Card => ({
  rank,
  suit,
  value,
  toString: () => `${rank}${suit[0].toUpperCase()}`,
})

export function createMockPlayerViewState(
  roomCode?: string,
  playerName?: string,
): MockPlayerViewState {
  const viewerName = playerName || 'You'

  const players: Player[] = [
    {
      id: 'p1',
      name: viewerName,
      position: 0,
      chips: 1450,
      currentBet: 0,
      status: 'active',
      holeCards: [createCard('A', 'spades', 14), createCard('A', 'hearts', 14)],
      lastAction: 'call',
      showCards: true,
    },
    {
      id: 'p2',
      name: 'Maya',
      position: 1,
      chips: 0,
      currentBet: 0,
      status: 'all_in',
      holeCards: [createCard('K', 'spades', 13), createCard('Q', 'spades', 12)],
      lastAction: 'raise',
      showCards: true,
    },
    {
      id: 'p3',
      name: 'Jules',
      position: 2,
      chips: 620,
      currentBet: 0,
      status: 'active',
      holeCards: [createCard('9', 'clubs', 9), createCard('9', 'diamonds', 9)],
      lastAction: 'fold',
      showCards: false,
    },
    {
      id: 'p4',
      name: 'Rin',
      position: 3,
      chips: 910,
      currentBet: 0,
      status: 'active',
      holeCards: [createCard('2', 'hearts', 2), createCard('7', 'hearts', 7)],
      lastAction: 'fold',
      showCards: false,
    },
  ]

  const game: GameState = {
    id: 'mock-game',
    roomCode: roomCode || 'DEV01',
    status: 'active',
    currentRound: 'showdown',
    pot: 900,
    pots: [
      {
        amount: 900,
        eligiblePlayers: [0, 1, 2, 3],
        winners: [0],
        winAmount: 900,
        winningRankName: 'Full House',
      },
    ],
    currentBet: 0,
    currentPlayerPosition: null,
    communityCards: [
      createCard('A', 'diamonds', 14),
      createCard('K', 'diamonds', 13),
      createCard('Q', 'hearts', 12),
      createCard('A', 'clubs', 14),
      createCard('2', 'spades', 2),
    ],
    players,
    dealerPosition: 2,
    winners: [],
    bigBlind: 20,
    handNumber: 12,
    isGameOver: false,
  }

  return {
    game,
    validActions: null,
    playerName: viewerName,
    betAmount: 0,
    raiseAmount: 0,
  }
}
