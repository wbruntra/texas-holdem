/**
 * Benchmark: state derivation performance
 *
 * Opens holdem.sqlite3 directly (bun:sqlite, no Knex overhead) and measures
 * how long deriveGameState takes for the most event-rich game in the database.
 *
 * Three scenarios:
 *   1. Full replay from scratch — baseline cost
 *   2. Derivation time as a function of event count — shows O(n) growth
 *   3. Checkpoint simulation — how much time is saved by snapshotting every N hands
 *
 * Usage:
 *   bun scripts/bench-state-derivation.ts [gameId]
 *   bun scripts/bench-state-derivation.ts          # auto-selects most event-rich game
 */

import { Database } from 'bun:sqlite'
import path from 'path'
import {
  deriveGameState,
  deriveFromSnapshot,
  applyEvent,
} from '../shared/state-derivation/index.ts'
import type { GameEvent } from '../shared/event-types.ts'

// ─── DB setup ────────────────────────────────────────────────────────────────

const DB_PATH = path.resolve(import.meta.dir, '../database/holdem.sqlite3')
const db = new Database(DB_PATH, { readonly: true })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hrMs(): number {
  return performance.now()
}

interface Stats {
  avg: number
  min: number
  max: number
  p50: number
  p95: number
}

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
  }
}

function fmtMs(n: number): string {
  return n < 1 ? `${(n * 1000).toFixed(0)}µs` : `${n.toFixed(2)}ms`
}

function fmtStats(s: Stats): string {
  return `avg=${fmtMs(s.avg)}  min=${fmtMs(s.min)}  p50=${fmtMs(s.p50)}  p95=${fmtMs(s.p95)}  max=${fmtMs(s.max)}`
}

function hr(char = '─', width = 72): string {
  return char.repeat(width)
}

// ─── Load game data ───────────────────────────────────────────────────────────

interface GameRow {
  id: number
  room_code: string
  status: string
  small_blind: number
  big_blind: number
  starting_chips: number
  event_count: number
}

// Pick target game: CLI arg or highest event count
const targetGameId = process.argv[2] ? parseInt(process.argv[2]) : null

let gameRow: GameRow
if (targetGameId) {
  const row = db
    .query<GameRow, [number]>(
      `SELECT g.id, g.room_code, g.status, g.small_blind, g.big_blind, g.starting_chips,
              COUNT(e.id) as event_count
       FROM games g LEFT JOIN game_events e ON g.id = e.game_id
       WHERE g.id = ?
       GROUP BY g.id`,
    )
    .get(targetGameId)
  if (!row) {
    console.error(`Game ${targetGameId} not found`)
    process.exit(1)
  }
  gameRow = row
} else {
  const row = db
    .query<GameRow, []>(
      `SELECT g.id, g.room_code, g.status, g.small_blind, g.big_blind, g.starting_chips,
              COUNT(e.id) as event_count
       FROM games g LEFT JOIN game_events e ON g.id = e.game_id
       GROUP BY g.id
       ORDER BY event_count DESC
       LIMIT 1`,
    )
    .get()
  if (!row) {
    console.error('No games found in database')
    process.exit(1)
  }
  gameRow = row
}

// Load all events
interface EventRow {
  id: number
  game_id: number
  hand_number: number
  sequence_number: number
  event_type: string
  player_id: number | null
  payload: string
}

const eventRows = db
  .query<EventRow, [number]>(
    `SELECT id, game_id, hand_number, sequence_number, event_type, player_id, payload
     FROM game_events
     WHERE game_id = ?
     ORDER BY hand_number ASC, sequence_number ASC`,
  )
  .all(gameRow.id)

const events: GameEvent[] = eventRows.map((row) => ({
  id: row.id,
  gameId: row.game_id,
  handNumber: row.hand_number,
  sequenceNumber: row.sequence_number,
  eventType: row.event_type as GameEvent['eventType'],
  playerId: row.player_id,
  payload: JSON.parse(row.payload),
}))

const gameConfig = {
  smallBlind: gameRow.small_blind,
  bigBlind: gameRow.big_blind,
  startingChips: gameRow.starting_chips,
}

// Group events by hand so we can simulate checkpoints
const handNumbers = [...new Set(events.map((e) => e.handNumber))].sort((a, b) => a - b)
const maxHand = handNumbers[handNumbers.length - 1] ?? 0
const eventsPerHand = new Map<number, GameEvent[]>()
for (const h of handNumbers) {
  eventsPerHand.set(
    h,
    events.filter((e) => e.handNumber === h),
  )
}

// Count snapshots already in the DB for this game
const snapshotCount =
  db
    .query<{ n: number }, [number]>('SELECT COUNT(*) as n FROM game_snapshots WHERE game_id = ?')
    .get(gameRow.id)?.n ?? 0

// ─── Print header ─────────────────────────────────────────────────────────────

console.log()
console.log(hr('═'))
console.log('  State Derivation Benchmark')
console.log(hr('═'))
console.log(
  `  Game #${gameRow.id}  room=${gameRow.room_code}  status=${gameRow.status}  blinds=${gameRow.small_blind}/${gameRow.big_blind}`,
)
console.log(
  `  Total events: ${events.length}   Hands: ${handNumbers.length}   Avg events/hand: ${(events.length / Math.max(handNumbers.length, 1)).toFixed(1)}   Snapshots in DB: ${snapshotCount}`,
)
console.log(hr('─'))
console.log()

// ─── Scenario 1: Full replay from scratch ────────────────────────────────────

const RUNS_FULL = 200

console.log(`  SCENARIO 1 — Full replay from scratch  (${RUNS_FULL} runs)`)
console.log(hr('─'))

// Warm-up
deriveGameState(gameConfig, [], events)

const fullSamples: number[] = []
for (let i = 0; i < RUNS_FULL; i++) {
  const t0 = hrMs()
  deriveGameState(gameConfig, [], events)
  fullSamples.push(hrMs() - t0)
}

const fullStats = stats(fullSamples)
console.log(`  ${fmtStats(fullStats)}`)
console.log()

// ─── Scenario 2: Derivation time vs event count ───────────────────────────────

const RUNS_SLICE = 100
const STEPS = 10

console.log(`  SCENARIO 2 — Derivation time vs event count  (${RUNS_SLICE} runs each)`)
console.log(hr('─'))
console.log(
  `  ${'Events'.padEnd(10)} ${'Hands'.padEnd(8)} ${'Avg'.padEnd(10)} ${'p50'.padEnd(10)} ${'p95'.padEnd(10)} Max`,
)
console.log(`  ${hr('-', 60)}`)

for (let step = 1; step <= STEPS; step++) {
  const sliceCount = Math.round((events.length * step) / STEPS)
  const slice = events.slice(0, sliceCount)
  const handsInSlice = new Set(slice.map((e) => e.handNumber)).size

  // Warm-up
  deriveGameState(gameConfig, [], slice)

  const samples: number[] = []
  for (let i = 0; i < RUNS_SLICE; i++) {
    const t0 = hrMs()
    deriveGameState(gameConfig, [], slice)
    samples.push(hrMs() - t0)
  }

  const s = stats(samples)
  console.log(
    `  ${String(sliceCount).padEnd(10)} ${String(handsInSlice).padEnd(8)} ${fmtMs(s.avg).padEnd(10)} ${fmtMs(s.p50).padEnd(10)} ${fmtMs(s.p95).padEnd(10)} ${fmtMs(s.max)}`,
  )
}

console.log()

// ─── Scenario 3: Checkpoint simulation ───────────────────────────────────────
//
// For each interval K (snapshot every K hands), we:
//   1. Pre-compute the "snapshot" state at the last hand boundary before maxHand
//   2. Time how long it takes to replay from that snapshot to the final state
//   3. This simulates the cost of the hot path: "load snapshot + replay delta"
//
// The pre-computation itself is NOT timed (it represents offline work done at
// checkpoint creation time). Only the forward-replay from the snapshot is timed.

const RUNS_CHECKPOINT = 200
const CHECKPOINT_INTERVALS = [1, 2, 5, 10, 20, maxHand] // hands between snapshots

console.log(
  `  SCENARIO 3 — Checkpoint simulation  (${RUNS_CHECKPOINT} runs each, target = hand ${maxHand})`,
)
console.log(hr('─'))
console.log(
  `  ${'Interval'.padEnd(12)} ${'Snap@hand'.padEnd(12)} ${'Delta evts'.padEnd(13)} ${'Avg'.padEnd(10)} ${'p50'.padEnd(10)} ${'p95'.padEnd(10)} Max`,
)
console.log(`  ${hr('-', 70)}`)

// Pre-compute state at the end of each hand boundary for all intervals we need
const snapshotCache = new Map<number, ReturnType<typeof deriveGameState>>()

function getSnapshotAtHand(upToHand: number) {
  if (snapshotCache.has(upToHand)) return snapshotCache.get(upToHand)!
  const eventsUpTo = events.filter((e) => e.handNumber <= upToHand)
  const state = deriveGameState(gameConfig, [], eventsUpTo)
  snapshotCache.set(upToHand, state)
  return state
}

for (const interval of CHECKPOINT_INTERVALS) {
  // The latest snapshot hand that falls on this interval boundary
  const snapshotHand =
    interval >= maxHand ? 0 : Math.floor(maxHand / interval) * interval - interval
  const clampedSnapshotHand = Math.max(0, snapshotHand)

  // Events that come after this snapshot (the "delta" to replay)
  const deltaEvents = events.filter((e) => e.handNumber > clampedSnapshotHand)

  // Pre-compute the snapshot state (not timed)
  const snapshotState = clampedSnapshotHand === 0 ? null : getSnapshotAtHand(clampedSnapshotHand)

  // Helper: replay delta events from a snapshot state using applyEvent directly.
  // We don't use deriveFromSnapshot here because sequence_number resets to 0 per
  // hand, so its `seq > lastSeq` filter would incorrectly drop events from later
  // hands. Since deltaEvents are already scoped to hands after the snapshot, a
  // plain loop is correct and avoids the ambiguity.
  function replayDelta() {
    if (!snapshotState) return deriveGameState(gameConfig, [], deltaEvents)
    let state = snapshotState
    for (const event of deltaEvents) state = applyEvent(state, event)
    return state
  }

  // Warm-up
  replayDelta()

  // Timed runs
  const samples: number[] = []
  for (let i = 0; i < RUNS_CHECKPOINT; i++) {
    const t0 = hrMs()
    replayDelta()
    samples.push(hrMs() - t0)
  }

  const s = stats(samples)
  const intervalLabel = interval >= maxHand ? 'none (full)' : `every ${interval}`
  console.log(
    `  ${intervalLabel.padEnd(12)} ${String(clampedSnapshotHand).padEnd(12)} ${String(deltaEvents.length).padEnd(13)} ${fmtMs(s.avg).padEnd(10)} ${fmtMs(s.p50).padEnd(10)} ${fmtMs(s.p95).padEnd(10)} ${fmtMs(s.max)}`,
  )
}

console.log()

// ─── Scenario 4: Current snapshot strategy in DB ─────────────────────────────
//
// Use the actual snapshots saved in the database to show what the live system
// is doing right now vs. a full cold replay.

const dbSnapshots = db
  .query<{ hand_number: number; last_sequence_number: number; state: string }, [number]>(
    `SELECT hand_number, last_sequence_number, state
     FROM game_snapshots
     WHERE game_id = ?
     ORDER BY hand_number DESC
     LIMIT 1`,
  )
  .get(gameRow.id)

if (dbSnapshots) {
  const RUNS_SNAP = 200
  console.log(`  SCENARIO 4 — Live snapshot from DB  (${RUNS_SNAP} runs)`)
  console.log(hr('─'))

  const snapshotState = JSON.parse(dbSnapshots.state)
  const deltaEvents = events.filter(
    (e) =>
      e.handNumber > dbSnapshots.hand_number ||
      (e.handNumber === dbSnapshots.hand_number &&
        e.sequenceNumber > dbSnapshots.last_sequence_number),
  )

  console.log(
    `  Latest snapshot: hand=${dbSnapshots.hand_number}  seq=${dbSnapshots.last_sequence_number}`,
  )
  console.log(`  Delta events to replay: ${deltaEvents.length} of ${events.length} total`)
  console.log(
    `  Snapshot savings: ${((1 - deltaEvents.length / events.length) * 100).toFixed(1)}% fewer events`,
  )
  console.log()

  // Warm-up
  deriveFromSnapshot(snapshotState, dbSnapshots.last_sequence_number, deltaEvents)

  const snapSamples: number[] = []
  for (let i = 0; i < RUNS_SNAP; i++) {
    const t0 = hrMs()
    deriveFromSnapshot(snapshotState, dbSnapshots.last_sequence_number, deltaEvents)
    snapSamples.push(hrMs() - t0)
  }

  const snapStats = stats(snapSamples)
  console.log(`  From snapshot: ${fmtStats(snapStats)}`)
  console.log(
    `  vs full replay: avg speedup = ${(fullStats.avg / snapStats.avg).toFixed(1)}x  (${fmtMs(fullStats.avg)} → ${fmtMs(snapStats.avg)})`,
  )
  console.log()
} else {
  console.log(`  SCENARIO 4 — No snapshots in DB for this game, skipping.`)
  console.log()
}

// ─── Scenario 5: Full end-to-end cost — DB query + JSON parse + derive ────────
//
// This is what getGameById() *actually* does on every request right now:
//   1. SELECT all events from game_events (DB I/O)
//   2. JSON.parse each payload
//   3. deriveGameState from scratch
//
// The previous scenarios only measured step 3. This measures the real wall time.

const RUNS_E2E = 100

console.log(`  SCENARIO 5 — End-to-end: DB fetch + JSON parse + derive  (${RUNS_E2E} runs)`)
console.log(`  (This is what getGameById does on every request today)`)
console.log(hr('─'))

// Prepare the raw SQL for bun:sqlite (bypasses Knex overhead)
const fetchEventsStmt = db.query<EventRow, [number]>(
  `SELECT id, game_id, hand_number, sequence_number, event_type, player_id, payload
   FROM game_events
   WHERE game_id = ?
   ORDER BY hand_number ASC, sequence_number ASC`,
)

// Warm-up
{
  const rows = fetchEventsStmt.all(gameRow.id)
  const evs: GameEvent[] = rows.map((r) => ({
    ...r,
    eventType: r.event_type as GameEvent['eventType'],
    payload: JSON.parse(r.payload),
    gameId: r.game_id,
    handNumber: r.hand_number,
    sequenceNumber: r.sequence_number,
    playerId: r.player_id,
  }))
  deriveGameState(gameConfig, [], evs)
}

const e2eSamples: number[] = []
const e2eQuerySamples: number[] = []
const e2eDeriveSamples: number[] = []

for (let i = 0; i < RUNS_E2E; i++) {
  const t0 = hrMs()
  const rows = fetchEventsStmt.all(gameRow.id)
  const tAfterQuery = hrMs()
  const evs: GameEvent[] = rows.map((r) => ({
    ...r,
    eventType: r.event_type as GameEvent['eventType'],
    payload: JSON.parse(r.payload),
    gameId: r.game_id,
    handNumber: r.hand_number,
    sequenceNumber: r.sequence_number,
    playerId: r.player_id,
  }))
  const tAfterParse = hrMs()
  deriveGameState(gameConfig, [], evs)
  const tEnd = hrMs()

  e2eSamples.push(tEnd - t0)
  e2eQuerySamples.push(tAfterQuery - t0)
  e2eDeriveSamples.push(tEnd - tAfterParse)
}

const e2eStats = stats(e2eSamples)
const queryStats = stats(e2eQuerySamples)
const deriveOnlyStats = stats(e2eDeriveSamples)

console.log(`  Total (query+parse+derive): ${fmtStats(e2eStats)}`)
console.log(`  DB query only:              ${fmtStats(queryStats)}`)
console.log(`  Derive only (in-memory):    ${fmtStats(deriveOnlyStats)}`)
console.log()

// Summary
console.log(hr('─'))
console.log(`  SUMMARY`)
console.log(hr('─'))
console.log(
  `  Full e2e (current system):          avg=${fmtMs(e2eStats.avg)}  p95=${fmtMs(e2eStats.p95)}`,
)
console.log(
  `  Pure derivation (no I/O):           avg=${fmtMs(fullStats.avg)}  p95=${fmtMs(fullStats.p95)}`,
)
console.log(
  `  I/O share of total cost:            ${((queryStats.avg / e2eStats.avg) * 100).toFixed(0)}% is DB query, ${((deriveOnlyStats.avg / e2eStats.avg) * 100).toFixed(0)}% is derive`,
)

if (dbSnapshots) {
  const snapBlobSize = dbSnapshots.state.length
  console.log(`  Snapshot blob size (latest):        ${(snapBlobSize / 1024).toFixed(1)} KB`)
  console.log(`  Note: snapshots are saved but getGameById never reads them.`)
}
console.log()

console.log(hr('═'))
console.log()

db.close()
