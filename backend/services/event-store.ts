// @ts-ignore
import db from '@holdem/database/db'
import { EVENT_TYPES, type EventType } from '@holdem/shared'

export interface GameEvent {
  id?: number
  gameId: number
  handNumber: number
  sequenceNumber: number
  eventType: EventType
  playerId: number | null
  payload: Record<string, any>
  createdAt?: string
}

/**
 * Append a single event to the store
 */
export async function appendEvent(
  gameId: number,
  handNumber: number,
  eventType: EventType,
  playerId: number | null,
  payload: Record<string, any>,
): Promise<number> {
  const [lastEvent] = await db('game_events')
    .where({ game_id: gameId, hand_number: handNumber })
    .orderBy('sequence_number', 'desc')
    .limit(1)
    .select('sequence_number')

  const sequenceNumber = lastEvent ? lastEvent.sequence_number + 1 : 0

  const [id] = await db('game_events').insert({
    game_id: gameId,
    hand_number: handNumber,
    sequence_number: sequenceNumber,
    event_type: eventType,
    player_id: playerId,
    payload: JSON.stringify(payload),
  })

  return id
}

/**
 * Append multiple events to the store in a batch
 * NOTE: Provide sequence numbers manually or ensure they are sequential
 */
export async function appendEvents(
  events: {
    gameId: number
    handNumber: number
    sequenceNumber: number
    eventType: EventType
    playerId: number | null
    payload: Record<string, any>
  }[],
): Promise<void> {
  if (events.length === 0) return

  const rows = events.map((e) => ({
    game_id: e.gameId,
    hand_number: e.handNumber,
    sequence_number: e.sequenceNumber,
    event_type: e.eventType,
    player_id: e.playerId,
    payload: JSON.stringify(e.payload),
  }))

  await db('game_events').insert(rows)
}

/**
 * Get events for a game, optionally starting after a specific hand and sequence
 */
export async function getEvents(
  gameId: number,
  afterHand?: number,
  afterSequence?: number,
): Promise<GameEvent[]> {
  let query = db('game_events').where({ game_id: gameId })

  if (afterHand !== undefined) {
    if (afterSequence !== undefined) {
      query = query.andWhere(function (this: any) {
        this.where('hand_number', '>', afterHand).orWhere(function (this: any) {
          this.where('hand_number', '=', afterHand).andWhere('sequence_number', '>', afterSequence)
        })
      })
    } else {
      query = query.where('hand_number', '>', afterHand)
    }
  }

  const rows = await query.orderBy('hand_number', 'asc').orderBy('sequence_number', 'asc')

  return rows.map(mapRowToEvent)
}

/**
 * Get events for a specific hand
 */
export async function getHandEvents(gameId: number, handNumber: number): Promise<GameEvent[]> {
  const rows = await db('game_events')
    .where({ game_id: gameId, hand_number: handNumber })
    .orderBy('sequence_number', 'asc')

  return rows.map(mapRowToEvent)
}

/**
 * Get the next available sequence number for a hand
 */
export async function getNextSequenceNumber(gameId: number, handNumber: number): Promise<number> {
  const [lastEvent] = await db('game_events')
    .where({ game_id: gameId, hand_number: handNumber })
    .orderBy('sequence_number', 'desc')
    .limit(1)
    .select('sequence_number')

  return lastEvent ? lastEvent.sequence_number + 1 : 0
}

function mapRowToEvent(row: any): GameEvent {
  return {
    id: row.id,
    gameId: row.game_id,
    handNumber: row.hand_number,
    sequenceNumber: row.sequence_number,
    eventType: row.event_type as EventType,
    playerId: row.player_id,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    createdAt: row.created_at,
  }
}
