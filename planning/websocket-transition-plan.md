# WebSocket Transition Plan (REST → WS) — Texas Hold’em

## Why this change
The current UI (notably `frontend/src/pages/PlayerView.tsx`) uses adaptive polling:
- Always polls `GET /api/games/:gameId`.
- When it looks like it’s your turn, also polls `GET /api/games/:gameId/actions/valid`.
- Typical intervals: ~600ms when it’s your turn, ~1800ms otherwise, and slower when tab is hidden.

This works, but it creates unnecessary load and latency spikes (many redundant “no change” responses). WebSockets let the server push state updates only when state changes.

## Goals
- Replace *state polling* with server-push updates.
- Keep REST API fully working during migration (fallback path).
- Preserve existing authorization rules:
  - Player-specific game state: only show that player’s hole cards (except showdown).
  - Public/table state: no hole cards until showdown.
- Support reconnect/resume without breaking gameplay.
- Make the change incrementally, with clear rollback switches.

## Non-goals (for this migration)
- Rewriting game logic, DB schema, or betting logic.
- Multi-server scalability (we can design with it in mind, but we won’t implement distributed pub/sub immediately).
- New UX features.

## Current backend surface area (relevant)
Key REST endpoints used by the frontend today:
- Auth/session:
  - `POST /api/games/:gameId/join`
  - `POST /api/games/:gameId/auth`
- State fetch:
  - `GET /api/games/:gameId` (requires cookie session)
  - `GET /api/games/room/:roomCode/state` (public table display)
- Actions:
  - `GET /api/games/:gameId/actions/valid` (requires cookie session; may 403 when not authorized)
  - `POST /api/games/:gameId/actions`
  - `POST /api/games/:gameId/reveal-card`
  - `POST /api/games/:gameId/next-hand`

Backend server is created in `backend/bin/www` via Node-style `http.createServer(app)` (run under Bun), which is a good attachment point for a WS server.

## Target architecture (dual-stack)
We will run REST and WebSockets side-by-side.

### Principle: server pushes state *after* every mutation
Any endpoint that mutates game state already produces an updated state response (e.g., `POST /actions` returns the updated game state). We will also broadcast corresponding WS events for subscribers.

### Principle: per-connection sanitization
Broadcasting “raw game state” to everyone would leak hole cards.
Instead:
- Each WS connection is associated with either:
  - an authenticated player session (has `playerId`), or
  - a public/table subscriber (no auth)
- Outgoing state is sanitized per subscriber:
  - Player subscribers get their own hole cards; others are hidden unless showdown.
  - Table subscribers get no hole cards unless showdown.

### Transport choice
Use the `ws` package (WebSocketServer) attached to the existing HTTP server.
- Path: `/ws`
- Upgrade request includes cookies; we’ll reuse the existing cookie-session auth model.

> Note: Bun has its own WebSocket primitives, but attaching `ws` to the existing `http` server is the least disruptive to the current Express layout.

## WebSocket API: messages & flows
All messages are JSON objects with a stable envelope:

```json
{
  "type": "...",
  "requestId": "optional-string",
  "payload": { }
}
```

### Connection + auth
- Client connects to `ws(s)://<host>/ws`.
- Server reads cookie-session from the upgrade request.

Server emits:
- `hello` (always)
  - payload: `{ "serverTime": "ISO", "protocolVersion": 1 }`

If session is present and valid:
- server considers the connection authenticated as `playerId`.

If no valid session:
- server treats connection as unauthenticated (only allowed to subscribe to public/table streams).

### Subscriptions
We use explicit subscriptions to avoid leaking data.

Client → server:
- `subscribe`
  - payload: `{ "roomCode": "ABC123", "stream": "player" | "table" }`
  - Rules:
    - `stream=player` requires authenticated session and that player belongs to the game.
    - `stream=table` is public.

Server → client:
- `subscribed`
  - payload: `{ "gameId": "uuid", "roomCode": "ABC123", "stream": "..." }`

Then server sends an initial snapshot:
- `game_state`
  - payload: `{ "state": <sanitized game state>, "revision": <monotonic string> }`

### Revisions (dedupe + resume)
We need a stable way for clients to ignore old updates and to recover after reconnect.

Proposed `revision`:
- Use a monotonic value derived from persisted state:
  - Option A (recommended): add a `games.state_revision` integer that increments on every save.
  - Option B (minimal DB change): use `games.updated_at` ISO string, but ensure it changes for every mutation.

Client reconnect flow:
- Client sends `resume` after subscribing:
  - payload: `{ "lastRevision": "..." }`
- Server replies with:
  - `game_state` snapshot (authoritative), regardless of whether it thinks client is current.

### Server-push updates
Server → client:
- `game_state`
  - payload: `{ "state": <sanitized>, "revision": "...", "reason": "action"|"advance"|"reveal"|"next_hand"|"admin" }`

Optionally (phase 2+), push valid actions:
- `valid_actions`
  - payload: `{ "actions": <same shape as GET /actions/valid>, "revision": "..." }`

### Client → server actions (later phase)
We keep REST for mutations initially. Later we can add WS actions (optional).

Client → server:
- `submit_action`
  - payload: `{ "action": "call", "amount": 0 }`
Server → client:
- `ack` / `error` with `requestId`
- plus a `game_state` push to everyone

## Phased rollout plan (safe + incremental)

### Phase 0 — Baseline + instrumentation (no behavior change)
Outcome: we can measure current polling load and safely compare WS.
- Add basic metrics/logging:
  - count of `GET /games/:id` and `GET /actions/valid` per minute
  - response sizes and latency buckets
- Add a feature flag (env or config) for WS enablement:
  - `WS_ENABLED=false|true`

Rollback: nothing to roll back.

### Phase 1 — Add WS server + public “table state” stream
Outcome: prove WS plumbing without auth complexity.
- Implement WS server attached in `backend/bin/www`.
- Implement `subscribe` for `stream=table` using `roomCode`.
- On subscribe, send initial `game_state` snapshot using the same logic as `GET /games/room/:roomCode/state`.
- Broadcast to table subscribers whenever game state changes.

How to broadcast (minimal change):
- After state-changing REST endpoints succeed (`POST /start`, `POST /actions`, `POST /reveal-card`, `POST /next-hand`, join/leave), publish a “game updated” event.
- WS server listens to those events and pushes updated snapshots.

Rollback:
- Disable `WS_ENABLED`.
- Frontend remains on polling.

### Phase 2 — Authenticated “player state” stream (player-specific sanitization)
Outcome: authenticated PlayerView can stop polling `GET /games/:id`.
- Support `stream=player` subscription using cookie-session:
  - Validate session contains `playerId`.
  - Load player, confirm membership in the game.
- On subscribe, send `game_state` sanitized exactly like `GET /api/games/:gameId`.
- On any game update broadcast:
  - send per-connection sanitized state (each player gets their own hole cards).

Frontend migration (PlayerView):
- Add WS client connection when `joined && roomCode`.
- On successful WS subscribe:
  - stop polling `GET /api/games/:gameId`.
- Keep REST polling as fallback if WS fails to connect.

Rollback:
- Toggle frontend flag to fall back to polling.

### Phase 3 — Push `valid_actions` (remove “actions/valid” polling)
Outcome: no periodic “valid actions” polling.

Approach:
- Server computes valid actions for the authenticated player whenever:
  - `game_state` changes, and
  - it’s that player’s turn, and
  - game is active
- Server pushes `valid_actions` only to that one player connection.
- Client clears actions when:
  - it receives a `game_state` where it’s not the current player, or
  - it receives `valid_actions` with `canAct=false`

Keep REST endpoint:
- `GET /api/games/:gameId/actions/valid` stays for fallback and debugging.

### Phase 4 — Optional: WS-based mutations (keep REST in parallel)
Outcome: actions can be sent over WS, but REST remains supported.
- Add WS message `submit_action` mirroring `POST /api/games/:gameId/actions`.
- The server uses the same `actionService.submitAction()` code path.
- Server replies with `ack`/`error` and broadcasts updated `game_state`.

We can stop here and still get 90% of the benefit, because eliminating polling is the big win.

### Phase 5 — Deprecate polling (only after stable)
Outcome: polling becomes an emergency fallback only.
- Reduce polling frequency drastically or remove it behind a “debug” flag.
- Keep a manual “Reconnect” or auto-reconnect logic.

## Implementation details (backend)

### Where to attach WS server
- `backend/bin/www` creates `server = http.createServer(app)`.
- We attach `WebSocketServer` to `server` with `{ path: '/ws' }`.

### Session parsing during WS upgrade
Because REST auth uses `cookie-session`, WS upgrade must read cookies.
Options:
- Reuse cookie-session middleware logic by manually parsing the cookie and verifying the session format.
- Or use a small shared helper:
  - parse cookies from `req.headers.cookie`
  - validate session signature using the same keys

Simplest incremental approach:
- Start Phase 1 (public table) without session.
- Add session parsing in Phase 2.

### Broadcast mechanism
We need a server-internal event bus.
- Add a lightweight in-process pub/sub (`EventEmitter`) in backend.
- On each successful mutation endpoint, emit `game:updated` with `{ gameId }`.
- WS server listens, reloads game state via `gameService.getGameById(gameId)`, sanitizes, and pushes.

This avoids invasive refactors of game logic.

> If we later need multi-process scaling, this becomes a natural seam for Redis pub/sub.

## Implementation details (frontend)

### WS client responsibilities
- Connect and subscribe.
- Apply `game_state` updates as the single source of truth.
- Handle disconnects:
  - show “Reconnecting…” status
  - fall back to polling if WS is unavailable
  - on reconnect, request a snapshot (`resume`) and replace local state

### Gradual cutover logic (PlayerView)
- Default: keep polling.
- If WS connects + `subscribed` received:
  - stop polling loop (or increase delay to very large as backup).
- If WS disconnects for >N seconds:
  - resume polling.

## Risks & mitigations
- **Hole card leakage**: must sanitize per connection.
  - Mitigation: centralize sanitization; reuse the same rules as REST endpoints.
- **Out-of-order updates**: WS events may arrive late.
  - Mitigation: revisions + “replace snapshot” semantics.
- **Reconnect edge cases**: client may miss updates while offline.
  - Mitigation: `resume` triggers full snapshot.
- **Bun/WS compatibility**: ensure chosen WS library works under Bun.
  - Mitigation: start with Phase 1 minimal and validate locally; fall back to Bun-native WS server if needed.

## Testing strategy
- Unit tests (backend):
  - sanitization rules: showdown vs not, player vs table.
  - subscription authorization: cannot `stream=player` without session.
- Integration (manual at first):
  - two browsers as two players, verify each sees only their own hole cards.
  - table view sees none until showdown.
  - reconnect mid-hand and confirm state is correct.
- Regression: REST endpoints continue to work unchanged.

## Rollout checklist
- Phase 1 shipped behind `WS_ENABLED`.
- Phase 2 shipped behind frontend “use WS” flag.
- Compare:
  - request counts drop (especially `GET /games/:id`).
  - perceived UI latency improves (state updates arrive immediately).
- Only after stable, proceed to Phase 3 (valid actions push).
