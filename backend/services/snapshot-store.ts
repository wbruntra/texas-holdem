// @ts-ignore
import db from '@holdem/database/db'
import type { GameState } from '@holdem/shared'

export interface GameSnapshot {
  id: number
  gameId: number
  handNumber: number
  lastSequenceNumber: number
  state: GameState
  createdAt: string
}

/**
 * Save a snapshot of the game state
 */
export async function saveSnapshot(
  gameId: number,
  handNumber: number,
  lastSequenceNumber: number,
  state: GameState,
): Promise<number> {
  const [id] = await db('game_snapshots').insert({
    game_id: gameId,
    hand_number: handNumber,
    last_sequence_number: lastSequenceNumber,
    state: JSON.stringify(state),
  })
  return id
}

/**
 * Get the latest snapshot for a game
 */
export async function getLatestSnapshot(gameId: number): Promise<GameSnapshot | null> {
  const row = await db('game_snapshots')
    .where({ game_id: gameId })
    .orderBy('hand_number', 'desc')
    .orderBy('last_sequence_number', 'desc')
    .first()

  if (!row) return null

  return {
    id: row.id,
    gameId: row.game_id,
    handNumber: row.hand_number,
    lastSequenceNumber: row.last_sequence_number,
    state: typeof row.state === 'string' ? JSON.parse(row.state) : row.state,
    createdAt: row.created_at,
  }
}
