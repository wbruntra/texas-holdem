# State Derivation Performance Analysis

**Date:** 2026-03-15
**Tool:** `scripts/bench-state-derivation.ts`
**Dataset:** Game #5 — 610 events, 40 hands, ~15 events/hand

---

## How the current system works

Every time game state is needed, `getGameById()` does three things in sequence:

1. `SELECT * FROM game_events WHERE game_id = ?` — fetch all events from SQLite
2. `JSON.parse(row.payload)` for every row
3. `deriveGameState(config, [], events)` — replay all events from the initial state

There is no caching or shortcutting. Every request starts from zero.

---

## Results

### End-to-end cost (the real number)

| Phase            | avg                | p95        |
| ---------------- | ------------------ | ---------- |
| DB query         | 344µs              | 421µs      |
| JSON parse       | ~324µs (remainder) | —          |
| State derivation | 224µs              | 411µs      |
| **Total**        | **892µs**          | **1.21ms** |

The derivation math is actually the _minority_ of the cost. Fetching and deserializing rows from SQLite takes more time than replaying the events.

### Derivation scales linearly with event count

| Events | Hands | avg   |
| ------ | ----- | ----- |
| 61     | 5     | 19µs  |
| 183    | 12    | 63µs  |
| 305    | 21    | 88µs  |
| 488    | 33    | 127µs |
| 610    | 40    | 161µs |

Roughly O(n) as expected. At the current rate of ~15 events/hand, a 200-hand game (~3,000 events) would cost around 800µs of pure derivation and ~1.7ms total including I/O. Still well within acceptable range for a turn-based game.

---

## Snapshot analysis

The system was writing a snapshot (full serialized game state) to `game_snapshots` after every showdown, but `getLatestSnapshot()` was never called — `getGameById()` did not read them. The snapshots accumulated in the database as dead data.

A simulation of what snapshot-assisted replay _would_ cost, using a "checkpoint every N hands" strategy:

| Strategy       | Events replayed | avg derivation |
| -------------- | --------------- | -------------- |
| Every 1 hand   | 19              | 17µs           |
| Every 2 hands  | 54              | 22µs           |
| Every 5 hands  | 158             | 72µs           |
| Every 10 hands | 289             | 89µs           |
| Full replay    | 608             | 72µs           |

The per-hand savings are real but the absolute numbers are already so small that the cost of loading and deserializing a snapshot blob (~1.2 KB) from SQLite would likely eat most of the gain at current event volumes.

---

## Conclusion

At current scale, snapshots are not worth the complexity. The dead snapshot-writing code was removed. If a game ever grows to hundreds of hands (thousands of events), it would be worth revisiting — the right approach at that point would be to wire `getLatestSnapshot()` into `getGameById()` as a read-through cache, fetching only the delta events via `getEvents(gameId, afterHand, afterSeq)` which already supports that query pattern.

The benchmark script remains at `scripts/bench-state-derivation.ts` and accepts an optional game ID argument.
