export interface Player {
  id: string
  name: string
  position: number
  chips: number
  currentBet: number
  totalBet?: number
  status: string
  holeCards?: Array<{ rank: string; suit: string }>
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
  communityCards: Array<{ rank: string; suit: string }>
  players: Player[]
  dealerPosition: number
  winners?: number[]
  bigBlind?: number
  handNumber?: number
}

export interface ValidActions {
  canAct: boolean
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  callAmount?: number
  canBet: boolean
  minBet?: number
  maxBet?: number
  canRaise: boolean
  minRaise?: number
  maxRaise?: number
  canReveal?: boolean
  reason?: string
}
