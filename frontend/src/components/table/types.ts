export type Card = { rank: string; suit: string }

export interface Player {
  id: string
  name: string
  position: number
  chips: number
  currentBet: number
  totalBet?: number
  status: string
  holeCards?: Card[]
  lastAction?: string | null
  showCards?: boolean
}

export interface Pot {
  amount: number
  eligiblePlayers: number[]
  winners?: number[] | null
  winAmount?: number
  winningRankName?: string
}

export interface GameState {
  id: string
  roomCode: string
  status: string
  currentRound: string
  pot: number
  pots?: Pot[]
  currentBet: number
  currentPlayerPosition: number | null
  communityCards?: Card[]
  players: Player[]
  dealerPosition: number
  winners?: number[]
  bigBlind?: number
}
