# WebSocket Phase 1 Implementation Complete

## What was implemented

### Backend Changes

1. **Dependencies Added** (`backend/package.json`)
   - `ws@8.18.3` - WebSocket server library
   - `@types/ws@8.18.1` - TypeScript types for ws

2. **Event Bus** (`backend/lib/game-events.js`)
   - Lightweight EventEmitter-based pub/sub for game state changes
   - Decouples game logic from WebSocket broadcasting
   - Methods: `emitGameUpdate(gameId, reason)`, `onGameUpdate(handler)`

3. **WebSocket Service** (`backend/services/websocket-service.js`)
   - Manages WebSocket connections and subscriptions
   - Protocol: JSON messages with `{ type, payload, requestId? }`
   - Message types:
     - Server → Client: `hello`, `subscribed`, `game_state`, `error`
     - Client → Server: `subscribe`, `resume`
   - Phase 1: Only supports `stream=table` (public, no authentication)
   - Sanitization: No hole cards except during showdown
   - Broadcast: Pushes state updates to all subscribed table viewers

4. **Server Integration** (`backend/bin/www`)
   - WebSocket server attached to existing HTTP server on path `/ws`
   - Feature flag: `WS_ENABLED` (default: true; set to `false` to disable)
   - Logs startup status

5. **Event Emissions** (`backend/routes/games.js`)
   - All state-mutating endpoints now emit `game:updated` events:
     - `POST /games/:gameId/join` → reason: `join`
     - `POST /games/:gameId/start` → reason: `start`
     - `POST /games/:gameId/actions` → reason: `action`
     - `POST /games/:gameId/reveal-card` → reason: `reveal`
     - `POST /games/:gameId/next-hand` → reason: `next_hand`
     - `POST /games/:gameId/leave` → reason: `leave`

### Frontend Changes

1. **TableView WebSocket Client** (`frontend/src/pages/TableView.tsx`)
   - Connects to `ws://host/ws` (or `wss://` for HTTPS)
   - Subscribes to `table` stream for the room
   - Receives real-time `game_state` updates
   - **Graceful degradation**: Falls back to REST polling if WS fails
   - **Auto-reconnect**: Attempts reconnection after 3 seconds on disconnect
   - **Visual indicator**: Shows "⚡ WS" when connected, "🔄 POLL" when using fallback

## How to test

1. **Start the backend** (if not already running):

   ```bash
   cd backend
   bun run api
   ```

   You should see:

   ```
   Backend will run on port: 3660
   [WS] WebSocket server initialized on /ws
   WebSocket server enabled
   ```

2. **Start the frontend** (in another terminal):

   ```bash
   cd frontend
   bun run dev
   ```

3. **Create a game**:
   - Open `http://localhost:5173`
   - Create a new game
   - Note the room code

4. **Open the table view**:
   - Navigate to `http://localhost:5173/table/<ROOM_CODE>`
   - You should see "⚡ WS" indicator in the header (WebSocket connected)
   - Open browser DevTools Console, you'll see:
     ```
     [TableView] Connecting to WebSocket: ws://localhost:5173/ws
     [TableView] WebSocket connected
     [TableView] Server hello: {...}
     [TableView] Subscribed to table stream
     [TableView] Game state update: subscribe
     ```

5. **Test real-time updates**:
   - Open another browser tab and join the game as a player
   - Start the game and take actions
   - Watch the table view update **instantly** without polling delays
   - Check the console logs showing `[TableView] Game state update: action`

6. **Test fallback**:
   - In DevTools Console, run: `WebSocket.prototype.close.call(arguments[0])`
   - The indicator should change to "🔄 POLL"
   - The table view should continue working via REST polling
   - After 3 seconds, it should reconnect and show "⚡ WS" again

## Performance improvement

**Before (polling)**:

- Frontend polls `GET /api/games/room/:roomCode/state` every 2000ms
- For a 3-player game with 2 spectators, that's ~150 requests/minute
- Most responses return "no change" (wasted bandwidth)

**After (WebSocket)**:

- Frontend receives updates **only when state changes**
- For a typical hand (~20 actions over 2 minutes), that's ~20 pushes vs ~60 polls
- **67% reduction** in network traffic
- **Near-instant UI updates** (no polling delay)

## What's next (Phase 2)

- Authenticated "player" stream with per-player hole card sanitization
- PlayerView component migration to WebSocket
- Push `valid_actions` to eliminate action polling
- See [websocket-transition-plan.md](./websocket-transition-plan.md) for full roadmap

## Rollback

If issues arise:

1. Set `WS_ENABLED=false` in backend environment
2. Restart backend → WebSocket server won't initialize
3. Frontend automatically falls back to polling
4. System works exactly as before
