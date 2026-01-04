// @ts-ignore
import db from '@holdem/database/db'
import type { GameState, Player } from '@holdem/shared/game-types'

interface ShowdownPlayerInfo {
  player_id: number
  position: number
  hole_cards: any[]
  total_bet: number
  final_status: string
  final_chips: number
}

interface ShowdownPotBreakdown {
  pot_type: string
  amount: number
  eligible_players: number[]
}

interface ShowdownHistoryRecord {
  game_id: number
  hand_id: number
  hand_number: number
  community_cards: any[]
  player_info: ShowdownPlayerInfo[]
  pot_breakdown: ShowdownPotBreakdown[]
}

/**
 * Create showdown history record from game state
 */
export async function createShowdownHistory(
  gameId: number,
  handId: number,
  gameState: GameState,
): Promise<void> {
  try {
    // Extract raw player info at showdown moment
    const playerInfo: ShowdownPlayerInfo[] = gameState.players.map((player: Player) => ({
      player_id: typeof player.id === 'number' ? player.id : parseInt(String(player.id), 10),
      position: player.position,
      hole_cards: player.holeCards || [],
      total_bet: player.totalBet || 0,
      final_status: player.status,
      final_chips: player.chips,
    }))

    // Extract pot breakdown for debugging (if available)
    const potBreakdown: ShowdownPotBreakdown[] = []
    if (gameState.pots && Array.isArray(gameState.pots)) {
      gameState.pots.forEach((pot: any) => {
        potBreakdown.push({
          pot_type: pot.type || 'main',
          amount: pot.amount || 0,
          eligible_players: pot.eligiblePlayers || [],
        })
      })
    }

    // Insert showdown history record
    await db('showdown_history').insert({
      game_id: gameId,
      hand_id: handId,
      hand_number: gameState.handNumber,
      community_cards: JSON.stringify(gameState.communityCards || []),
      player_info: JSON.stringify(playerInfo),
      pot_breakdown: JSON.stringify(potBreakdown),
      created_at: new Date(),
      updated_at: new Date(),
    })

    console.log(`Showdown history recorded for game ${gameId}, hand ${gameState.handNumber}`)
  } catch (error) {
    console.error('Failed to create showdown history:', error)
    // Don't throw - this should not interrupt game flow
  }
}

/**
 * Get showdown history for a specific hand
 */
export async function getShowdownHistory(handId: number): Promise<any> {
  return await db('showdown_history').where({ id: handId }).first()
}

/**
 * Get all showdown histories for a game
 */
export async function getGameShowdownHistories(gameId: number): Promise<any[]> {
  return await db('showdown_history').where({ game_id: gameId }).orderBy('hand_number', 'asc')
}
