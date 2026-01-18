import type { GameState, Player } from '../game-types'

export interface GameConfig {
  smallBlind: number
  bigBlind: number
  startingChips: number
}

export interface PlayerConfig {
  id: number
  name: string
  position: number
}

export function createInitialState(config: GameConfig, players: PlayerConfig[]): GameState {
  // Map basic player config to full Player objects
  const gamePlayers: Player[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    chips: config.startingChips,
    currentBet: 0,
    totalBet: 0,
    holeCards: [],
    status: 'active',
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    lastAction: null,
    showCards: false,
  }))

  return {
    status: 'waiting',
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    players: gamePlayers,
    dealerPosition: 0,
    currentRound: null,
    currentPlayerPosition: null,
    pot: 0,
    pots: [],
    currentBet: 0,
    communityCards: [],
    deck: [],
    handNumber: 0,
    lastRaise: 0,
    showdownProcessed: false,
    action_finished: false,
  }
}
