# All-In Auto-Advance Notification System

## Problem Statement

In all-in situations where one active player remains with ≥1 all-in players, the hand cannot resolve through normal betting (no folds possible), but also no meaningful actions can be taken. Currently:

- The `shouldAutoAdvance()` function correctly identifies these situations
- The system auto-advances through rounds with a 2-second delay
- However, **clients are not informed** that auto-advance is happening
- The frontend doesn't have UI to indicate this special state
- Players may be confused why cards are being dealt without actions

## Solution Overview

We need to:

1. Add a new game state field to track auto-advance mode
2. Include this information in API responses and WebSocket updates
3. Enhance the frontend to display a clear indicator when in auto-advance mode
4. Ensure the terminal client also handles this gracefully

## Current Implementation Analysis

### Backend Auto-Advance Detection

**File:** `backend/lib/game-state-machine.ts` (lines 173-202)

```typescript
export function shouldAutoAdvance(state: GameState): boolean {
  if (state.currentRound === ROUND.SHOWDOWN) {
    return false
  }

  const activePlayers = state.players.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
  )

  if (activePlayers.length <= 1) {
    return true
  }

  const canBet = activePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE && p.chips > 0)

  if (canBet.length === 0) {
    return true
  }

  if (canBet.length === 1) {
    const player = canBet[0]
    return player.currentBet >= state.currentBet
  }

  return false
}
```

**Logic:** Returns `true` when:

- Only 1 or fewer active/all-in players remain, OR
- Zero players can bet (all are all-in), OR
- Exactly one player can bet AND they've matched the current bet

### Backend Auto-Advance Execution

**File:** `backend/services/game-service.ts` (lines 334-390)

The `advanceRoundIfReady()` function:

1. Checks `shouldAutoAdvance(gameState)` at the start
2. Stores this in `shouldAutoAdvanceNow`
3. If true, adds `autoAdvanceTimestamp` to game state
4. Advances through rounds automatically with 2-second delays
5. Uses a while loop to advance multiple rounds if needed

**Current gap:** The `autoAdvanceTimestamp` field is not exposed to clients.

### API Response Structure

**File:** `backend/routes/games.js`

Key endpoints that return game state:

- `GET /room/:roomCode/state` - Public table state (line 88-145)
- `GET /:gameId` - Authenticated player state (line 147-242)

Both sanitize the game state but **don't include auto-advance information**.

### Frontend Valid Actions Check

**File:** `backend/lib/betting-logic.ts` (lines 312-357)

The `getValidActions()` function already has special handling:

```typescript
if (playersWithChips.length === 1 && allInPlayers.length > 0) {
  if (player.currentBet >= state.currentBet) {
    return {
      canAct: false,
      canReveal: true,
      reason: 'All other players are all-in. Reveal cards to continue.',
    }
  }
}
```

This returns `canReveal: true` with a reason message, but this is for manual reveal, not auto-advance.

### Frontend Player View

**File:** `frontend/src/pages/PlayerView.tsx`

Shows valid actions including the reveal button when `canReveal` is true. Currently handles:

- Action buttons (fold, check, bet, raise, call)
- Card reveal interface
- Showdown display

**Current gap:** No indication when auto-advance is in progress.

### Frontend Table View

**File:** `frontend/src/pages/TableView.tsx`

Shows QR code and waiting state, displays the poker table scene.

**Current gap:** No auto-advance indicator on the spectator view.

## Implementation Plan

### Phase 1: Backend State Enhancement

#### 1.1 Add Auto-Advance Field to Game State

**File:** `shared/game-types.ts`

Add to `GameState` interface:

```typescript
export interface GameState {
  // ... existing fields
  autoAdvanceMode?: boolean
  autoAdvanceTimestamp?: number
}
```

Add to `ApiGameState` interface:

```typescript
export interface ApiGameState {
  // ... existing fields
  autoAdvanceMode?: boolean
  autoAdvanceReason?: string
}
```

#### 1.2 Update Game State Machine

**File:** `backend/lib/game-state-machine.ts`

Modify `advanceRound()` to preserve auto-advance state:

```typescript
export function advanceRound(state: GameState): GameState {
  // ... existing logic

  return {
    ...newState,
    autoAdvanceMode: shouldAutoAdvance(newState),
    autoAdvanceTimestamp: state.autoAdvanceTimestamp,
  }
}
```

#### 1.3 Update advanceRoundIfReady

**File:** `backend/services/game-service.ts`

At the beginning of each round advancement, check and set auto-advance mode:

```typescript
export async function advanceRoundIfReady(gameId: number) {
  const game = await getGameById(gameId)
  if (!game) {
    throw new Error('Game not found')
  }

  let gameState: any = game

  // Check auto-advance at the START of the function
  const shouldAutoAdvanceNow = shouldAutoAdvance(gameState)

  // Set the mode flag
  if (shouldAutoAdvanceNow) {
    gameState.autoAdvanceMode = true
    gameState.autoAdvanceTimestamp = Date.now()
  } else {
    gameState.autoAdvanceMode = false
    gameState.autoAdvanceTimestamp = undefined
  }

  // Save this immediately so clients get notified
  await saveGameState(gameId, gameState)

  // ... rest of existing while loop logic
}
```

#### 1.4 Update API Responses

**File:** `backend/routes/games.js`

Modify `GET /room/:roomCode/state` to include auto-advance info:

```javascript
const tableState = {
  id: game.id,
  roomCode: game.roomCode,
  // ... existing fields
  autoAdvanceMode: game.autoAdvanceMode || false,
  autoAdvanceReason: game.autoAdvanceMode
    ? 'All players are all-in. Cards will be revealed automatically.'
    : undefined,
}
```

Modify `GET /:gameId` (authenticated player view) similarly:

```javascript
const sanitizedState = {
  ...game,
  // ... existing fields
  autoAdvanceMode: game.autoAdvanceMode || false,
  autoAdvanceReason: game.autoAdvanceMode
    ? 'All players are all-in. Cards will be revealed automatically.'
    : undefined,
}
```

#### 1.5 Update Valid Actions Response

**File:** `backend/lib/betting-logic.ts`

Modify `getValidActions()` to be aware of auto-advance:

```typescript
export function getValidActions(state: GameState, playerPosition: number): ValidActions {
  // ... existing checks

  if (playersWithChips.length === 1 && allInPlayers.length > 0) {
    if (player.currentBet >= state.currentBet) {
      return {
        canAct: false,
        canReveal: false, // Don't allow manual reveal if auto-advancing
        autoAdvanceMode: true,
        reason: 'All players are all-in. Cards will be revealed automatically.',
      }
    }
  }

  // ... rest of function
}
```

Update the `ValidActions` type in `shared/game-types.ts`:

```typescript
export interface ValidActions {
  canAct: boolean
  canFold: boolean
  // ... existing fields
  autoAdvanceMode?: boolean
  reason?: string
}
```

### Phase 2: Frontend UI Enhancements

#### 2.1 Update Type Definitions

**File:** `frontend/src/components/table/types.ts` (if it exists) or relevant type file

Ensure the frontend GameState type includes:

```typescript
type GameState = {
  // ... existing fields
  autoAdvanceMode?: boolean
  autoAdvanceReason?: string
}
```

#### 2.2 Player View Auto-Advance Banner

**File:** `frontend/src/pages/PlayerView.tsx`

Add a prominent banner when in auto-advance mode, placed right after the pot display:

```tsx
{
  game.autoAdvanceMode && (
    <div className="alert alert-info mb-3 text-center py-3 shadow-sm">
      <div className="d-flex align-items-center justify-content-center gap-2">
        <div className="spinner-grow spinner-grow-sm text-info" role="status">
          <span className="visually-hidden">Auto-revealing...</span>
        </div>
        <strong>Auto-Reveal Mode</strong>
      </div>
      <small className="d-block mt-1">
        {game.autoAdvanceReason || 'All players are all-in. Cards will be revealed automatically.'}
      </small>
    </div>
  )
}
```

Position this banner:

- Below the pot/room info card
- Above the fold button (if visible)
- Above the player's hole cards

#### 2.3 Table View Auto-Advance Indicator

**File:** `frontend/src/pages/TableView.tsx` or `frontend/src/components/table/PokerTableScene.tsx`

Add an overlay banner at the top of the table view:

```tsx
{
  game.status === 'active' && game.autoAdvanceMode && (
    <div className="position-fixed top-0 start-50 translate-middle-x mt-3" style={{ zIndex: 100 }}>
      <div className="alert alert-info shadow-lg d-inline-flex align-items-center gap-2 mb-0">
        <div className="spinner-grow spinner-grow-sm" role="status">
          <span className="visually-hidden">Auto-revealing...</span>
        </div>
        <span className="fw-bold">Auto-Revealing Cards</span>
      </div>
    </div>
  )
}
```

#### 2.4 Update CommunityCenter Component

**File:** `frontend/src/components/table/CommunityCenter.tsx`

Consider adding a subtle indicator on the community cards area when auto-advancing:

```tsx
{
  game.autoAdvanceMode && (
    <div className="small text-info text-center mt-2">
      <span className="badge bg-info bg-opacity-25 text-info">🎴 Auto-revealing...</span>
    </div>
  )
}
```

#### 2.5 Disable Manual Actions During Auto-Advance

**File:** `frontend/src/pages/PlayerView.tsx`

Ensure action buttons are disabled during auto-advance:

```tsx
{game.status === 'active' && isMyTurn && validActions?.canAct && !game.autoAdvanceMode && (
  // ... action buttons
)}

{game.autoAdvanceMode && (
  <div className="alert alert-secondary text-center py-4">
    <div className="spinner-border spinner-border-sm text-secondary mb-2" role="status" />
    <div className="small">Waiting for cards to be revealed...</div>
  </div>
)}
```

### Phase 3: Terminal Client Updates

#### 3.1 Update Terminal Display

**File:** `terminal/display.ts`

Add a method to print auto-advance status:

```typescript
printAutoAdvanceStatus(game: GameState) {
  if (game.autoAdvanceMode) {
    console.log(chalk.yellow.bold('\n⚡ AUTO-REVEAL MODE ⚡'))
    console.log(chalk.yellow(game.autoAdvanceReason || 'All players are all-in. Cards will be revealed automatically.'))
    console.log('')
  }
}
```

#### 3.2 Update Game Loop

**File:** `terminal/game-loop.ts`

Call the auto-advance display in the main game loop:

```typescript
async printGameState() {
  try {
    const state = await this.api.getGameState(this.gameId)
    this.display.printGameState(state, this.playerName)

    // Show auto-advance indicator
    if (state.autoAdvanceMode) {
      this.display.printAutoAdvanceStatus(state)
    }
  } catch (err) {
    this.display.printError(`Failed to refresh state: ${err.message}`)
  }
}
```

#### 3.3 Update Action Selector

**File:** `terminal/action-selector.ts`

When displaying valid actions, check for auto-advance mode:

```typescript
async promptForAction(validActions: ValidActions, game: GameState): Promise<Action> {
  if (validActions.autoAdvanceMode) {
    console.log(chalk.yellow('\n⚠️  Auto-reveal mode active. No actions available.'))
    console.log(chalk.gray('Press Enter to continue...'))
    await inquirer.prompt({
      type: 'input',
      name: 'continue',
      message: '',
    })
    // Return a special action or throw
    throw new Error('No actions available in auto-advance mode')
  }

  // ... existing action selection logic
}
```

### Phase 4: Event Logging

#### 4.1 Add Event Type

**File:** `backend/lib/event-types.ts`

Add new event type:

```typescript
export const EVENT_TYPE = {
  // ... existing events
  AUTO_ADVANCE_STARTED: 'auto_advance:started',
  AUTO_ADVANCE_COMPLETED: 'auto_advance:completed',
} as const
```

#### 4.2 Log Auto-Advance Events

**File:** `backend/services/game-service.ts`

In `advanceRoundIfReady()`:

```typescript
if (shouldAutoAdvanceNow) {
  eventLogger.logEvent(
    EVENT_TYPE.AUTO_ADVANCE_STARTED,
    {
      round: gameState.currentRound,
      activePlayers: gameState.players.filter(
        (p) => p.status === 'active' || p.status === 'all_in',
      ).length,
      allInPlayers: gameState.players.filter((p) => p.status === 'all_in').length,
    },
    gameId,
  )
}

// At the end of the while loop:
if (shouldAutoAdvanceNow && gameState.currentRound === ROUND.SHOWDOWN) {
  eventLogger.logEvent(
    EVENT_TYPE.AUTO_ADVANCE_COMPLETED,
    {
      finalRound: gameState.currentRound,
      pot: gameState.pot,
    },
    gameId,
  )
}
```

### Phase 5: Testing Strategy

#### 5.1 Unit Tests

**File:** `backend/test/auto-advance.test.js` (new)

Test scenarios:

1. Two players, one all-in preflop → verify autoAdvanceMode = true
2. Three players, two all-in, one active → verify autoAdvanceMode = true
3. Two players, both with chips → verify autoAdvanceMode = false
4. Check that autoAdvanceMode persists through round advancement
5. Check that autoAdvanceMode clears at showdown

```javascript
test('sets autoAdvanceMode when one player with chips and others all-in', async () => {
  const game = await gameService.createGame()
  const p1 = await playerService.joinGame(game.id, 'Alice', 'pass1')
  const p2 = await playerService.joinGame(game.id, 'Bob', 'pass2')

  await gameService.startHand(game.id)

  // Bob goes all-in
  await actionService.submitAction(p2.id, 'all_in', 100)

  // Alice calls
  await actionService.submitAction(p1.id, 'call', 100)

  const state = await gameService.getGameById(game.id)
  expect(state.autoAdvanceMode).toBe(true)
  expect(state.autoAdvanceReason).toBeTruthy()
})

test('clears autoAdvanceMode after showdown', async () => {
  // ... setup all-in scenario
  // ... advance to showdown
  // ... start new hand
  const state = await gameService.getGameById(game.id)
  expect(state.autoAdvanceMode).toBe(false)
})
```

#### 5.2 Integration Tests

Create simulation script to verify end-to-end flow:

**File:** `simulate_auto_advance.js` (new)

```javascript
// 1. Create game
// 2. Two players join
// 3. Start game
// 4. One player goes all-in preflop
// 5. Other player calls
// 6. Verify autoAdvanceMode appears in API response
// 7. Verify rounds advance automatically
// 8. Verify showdown completes
// 9. Verify next hand clears autoAdvanceMode
```

#### 5.3 Manual Frontend Testing

1. Open player view on mobile
2. Create two-player game
3. Both go all-in preflop
4. Verify banner appears: "Auto-Reveal Mode"
5. Verify spinner shows cards are being revealed
6. Verify action buttons are hidden
7. Open table view in another window
8. Verify table shows auto-advance indicator at top
9. Verify cards appear with ~2 second delays

### Phase 6: Documentation Updates

#### 6.1 Update README

Add section about auto-advance behavior:

```markdown
### Auto-Advance Mode

When all but one player are all-in, the game enters auto-advance mode:

- Remaining community cards are revealed automatically
- 2-second delay between each street (flop, turn, river)
- Players see a clear indicator that auto-reveal is in progress
- No manual actions are required or possible
- Proceeds directly to showdown
```

#### 6.2 Update AGENTS.md

Add note about the auto-advance feature in the game flow section.

#### 6.3 Update Planning Doc

Document this feature in `planning/` folder (this document!).

## Edge Cases to Consider

### 1. Auto-Advance Interrupted by Disconnection

**Scenario:** Auto-advance starts, server restarts mid-advance.

**Solution:** On server restart, `advanceRoundIfReady()` is called on game load. The `shouldAutoAdvance()` check will still return true, so advancement resumes.

### 2. Player Reconnects During Auto-Advance

**Scenario:** Player disconnects, auto-advance happens, player reconnects.

**Solution:** WebSocket subscription sends full game state including `autoAdvanceMode`. UI updates immediately to show auto-advance indicator.

### 3. Last Active Player Has No Chips

**Scenario:** Player 1 has 0 chips but is "active", Player 2 is all-in.

**Solution:** `shouldAutoAdvance()` checks `p.status === PLAYER_STATUS.ACTIVE && p.chips > 0`, so this scenario returns `canBet.length === 0`, triggering auto-advance correctly.

### 4. Multiple Side Pots During Auto-Advance

**Scenario:** Three players, all-in at different amounts.

**Solution:** Auto-advance mode doesn't affect pot calculation. The existing `pot-manager` handles side pots correctly. Auto-advance only affects card revelation timing.

### 5. Manual Reveal Button vs Auto-Advance

**Scenario:** Player sees both "reveal card" button and auto-advance indicator.

**Solution:** When `autoAdvanceMode === true`, set `canReveal = false` in valid actions to hide the manual button. Show only the auto-advance indicator.

### 6. Terminal Client Polling

**Scenario:** Terminal client polls every 2 seconds, same as auto-advance delay.

**Solution:** Terminal client will see intermediate states. Display should show auto-advance indicator on every refresh during this period.

## API Contract Changes

### Response Schema Changes

**GET /room/:roomCode/state**

Added fields:

```typescript
{
  // ... existing fields
  autoAdvanceMode: boolean       // NEW: true when auto-advancing
  autoAdvanceReason?: string     // NEW: explanation message
}
```

**GET /:gameId (authenticated)**

Added fields:

```typescript
{
  // ... existing fields
  autoAdvanceMode: boolean       // NEW: true when auto-advancing
  autoAdvanceReason?: string     // NEW: explanation message
}
```

**GET /:gameId/actions/valid**

Added fields:

```typescript
{
  // ... existing fields
  autoAdvanceMode?: boolean      // NEW: true when in auto-advance
  reason?: string                // ENHANCED: now includes auto-advance reason
}
```

### WebSocket Message Changes

The `game_state` message payload now includes:

```typescript
{
  state: {
    // ... existing fields
    autoAdvanceMode: boolean
    autoAdvanceReason?: string
  },
  revision: string,
  reason: string
}
```

## Performance Considerations

### Backend

- **State Storage:** Adding two fields (`autoAdvanceMode`, `autoAdvanceTimestamp`) has negligible impact
- **Computation:** `shouldAutoAdvance()` already exists and is called; no new expensive operations
- **Database:** Fields are in-memory only, serialized to `state` JSON column as before

### Frontend

- **Rendering:** Auto-advance banner is conditional, only renders when `autoAdvanceMode === true`
- **WebSocket:** No additional messages; existing `game_state` messages just have extra fields
- **Memory:** Negligible impact (two additional boolean/string fields)

### Network

- **Bandwidth:** ~50 bytes added to each game state response when auto-advance is active
- **Latency:** No change; same number of round-trip requests

## Implementation Checklist

- [ ] Phase 1: Backend State Enhancement
  - [ ] 1.1 Add fields to `shared/game-types.ts`
  - [ ] 1.2 Update `advanceRound()` in `game-state-machine.ts`
  - [ ] 1.3 Update `advanceRoundIfReady()` in `game-service.ts`
  - [ ] 1.4 Update API responses in `routes/games.js`
  - [ ] 1.5 Update `getValidActions()` in `betting-logic.ts`

- [ ] Phase 2: Frontend UI Enhancements
  - [ ] 2.1 Update type definitions
  - [ ] 2.2 Add auto-advance banner to `PlayerView.tsx`
  - [ ] 2.3 Add auto-advance indicator to `TableView.tsx`
  - [ ] 2.4 Update `CommunityCenter.tsx` (optional)
  - [ ] 2.5 Disable manual actions during auto-advance

- [ ] Phase 3: Terminal Client Updates
  - [ ] 3.1 Add `printAutoAdvanceStatus()` to `display.ts`
  - [ ] 3.2 Update `game-loop.ts`
  - [ ] 3.3 Update `action-selector.ts`

- [ ] Phase 4: Event Logging
  - [ ] 4.1 Add event types to `event-types.ts`
  - [ ] 4.2 Add logging to `game-service.ts`

- [ ] Phase 5: Testing
  - [ ] 5.1 Write unit tests
  - [ ] 5.2 Create integration simulation script
  - [ ] 5.3 Manual frontend testing

- [ ] Phase 6: Documentation
  - [ ] 6.1 Update README.md
  - [ ] 6.2 Update AGENTS.md
  - [ ] 6.3 This planning document

## Estimated Implementation Time

- **Phase 1 (Backend):** 2 hours
- **Phase 2 (Frontend UI):** 2 hours
- **Phase 3 (Terminal):** 1 hour
- **Phase 4 (Logging):** 30 minutes
- **Phase 5 (Testing):** 2 hours
- **Phase 6 (Documentation):** 30 minutes

**Total:** ~8 hours for complete implementation

## Success Criteria

1. ✅ When one active player remains with ≥1 all-in players, `autoAdvanceMode` is set to `true`
2. ✅ API endpoints include `autoAdvanceMode` and `autoAdvanceReason` fields
3. ✅ WebSocket updates propagate auto-advance state changes
4. ✅ Player view shows prominent "Auto-Reveal Mode" banner
5. ✅ Table view shows auto-advance indicator
6. ✅ Terminal client displays auto-advance status
7. ✅ Manual action buttons are hidden during auto-advance
8. ✅ Cards are revealed automatically with 2-second delays
9. ✅ Auto-advance mode clears after showdown completes
10. ✅ All tests pass

## Future Enhancements

### Optional Improvements (Not in Initial Scope)

1. **Configurable Delay:** Allow game creator to set auto-advance delay (1-5 seconds)
2. **Skip Animation:** Button for players to skip remaining auto-reveals and jump to showdown
3. **Sound Effects:** Special sound when entering auto-advance mode
4. **Countdown Timer:** Show visual countdown during the 2-second delays
5. **Animation:** Smooth card flip animation during auto-reveal
6. **Notification:** Browser notification when auto-advance completes (if player is in background)
