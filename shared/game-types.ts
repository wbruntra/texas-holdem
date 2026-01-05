// Base Card type (matches poker-engine)
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
  value: number
  toString(): string
}

// Base types for enums
export type GameStatus = 'waiting' | 'active' | 'completed'
export type Round = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type PlayerStatus = 'active' | 'folded' | 'all_in' | 'out'

// Base Player interface (backend internal)
export interface Player {
  id: string | number
  name: string
  position: number
  chips: number
  currentBet: number
  totalBet?: number
  holeCards: Card[]
  status: PlayerStatus
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  lastAction: string | null
  showCards: boolean
}

// Base Pot interface
export interface Pot {
  amount: number
  eligiblePlayers: number[]
  winners: number[] | null
  winAmount?: number
  winningRankName?: string
}

// Base GameState interface (backend internal)
export interface GameState {
  status: GameStatus
  smallBlind: number
  bigBlind: number
  players: Player[]
  dealerPosition: number
  currentRound: Round | null
  currentPlayerPosition: number | null
  pot: number
  pots: Pot[]
  currentBet: number
  communityCards: Card[]
  deck: Card[]
  handNumber: number
  lastRaise: number
  showdownProcessed: boolean
  action_finished?: boolean
  seed?: string
  winners?: number[]
}

// API-specific interfaces (frontend/terminal)
export interface ApiPlayer {
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

export interface ApiGameState {
  id: string
  roomCode: string
  status: string
  currentRound: string
  pot: number
  pots?: Pot[]
  currentBet: number
  currentPlayerPosition: number | null
  action_finished?: boolean
  communityCards: Card[]
  players: ApiPlayer[]
  dealerPosition: number
  winners?: number[] | null
  bigBlind?: number
  handNumber?: number
}

// Additional shared interfaces
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
  canNextHand?: boolean
  canAdvance?: boolean
  advanceReason?: string
  reason?: string
}

export interface ActionValidation {
  valid: boolean
  error?: string
}
