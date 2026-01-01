export type Card = { rank: string; suit: string }

export interface Player {
  id: string
  name: string
  position: number
  chips: number
  currentBet: number
  status: string
  holeCards?: Card[]
  lastAction?: string | null
}

export interface Pot {
  amount: number
  eligiblePlayers: number[]
  winners?: number[] | null
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
}
