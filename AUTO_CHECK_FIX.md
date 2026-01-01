# Auto-Check Fix for All-In Scenarios

## Problem

When one or more players are all-in and only one player remains with chips to act, the game was still requiring that player to manually check on each betting round (flop, turn, river) even though no meaningful betting could occur. This created unnecessary UI interactions where the player had to click "Check" multiple times.

### Example Scenario

```
Hand #3 - YGPN4P
- Preflop: Player A raises, Player B goes all-in for $821, Player A calls
- Player A now has $0 (all-in)
- Player B has chips remaining but no one to bet against

Original behavior:
- Flop: Board revealed, Player B must click "Check"
- Turn: Board revealed, Player B must click "Check"
- River: Board revealed, Player B must click "Check"
- Then showdown

Expected behavior:
- Flop: Board auto-revealed, auto-check for Player B
- Turn: Board auto-revealed, auto-check for Player B
- River: Board auto-revealed, auto-check for Player B
- Then showdown
```

## Solution

Modified [`backend/services/game-service.js`](backend/services/game-service.js) in the `advanceRoundIfReady` function to automatically simulate a check action when:

1. `shouldAutoAdvance(gameState)` returns true (indicating all-in situation)
2. `currentPlayerPosition` is set (someone needs to act)
3. Exactly one active player with chips remains
4. Current bet is 0 (no bet to call, so check is the only option)

The auto-check:

- Uses the existing `processAction` function to ensure proper state management
- Records the action in the database with `recordAction` for hand history
- Happens transparently within the game loop before attempting to advance rounds

## Code Changes

### backend/services/game-service.js

Added logic inside the `advanceRoundIfReady` while loop to detect and handle auto-check scenarios:

```javascript
// Before advancing, if only one player can act and they need to check, do it automatically
if (shouldAutoAdvance(gameState) && gameState.currentPlayerPosition !== null) {
  const activePlayers = gameState.players.filter((p) => p.status === 'active' && p.chips > 0)

  // If exactly one player can act and no bet to call, auto-check
  if (activePlayers.length === 1 && gameState.currentBet === 0) {
    const actingPlayer = activePlayers[0]
    const playerPosition = gameState.players.findIndex((p) => p.id === actingPlayer.id)

    if (playerPosition === gameState.currentPlayerPosition) {
      const { processAction } = require('../lib/betting-logic')

      // Auto-check for this player
      gameState = processAction(gameState, playerPosition, 'check', 0)
      await saveGameState(gameId, gameState)

      // Record the auto-check action
      const { recordAction } = require('./action-service')
      await recordAction(gameId, actingPlayer.id, 'check', 0, gameState.currentRound)
    }
  }
}
```

## Why This Approach

### Alternative Approaches Considered

1. **Skip setting currentPlayerPosition**: Would break other game logic expecting a player to act
2. **Add special "auto-advance" action type**: Adds complexity and new action type
3. **Modify frontend to auto-submit check**: Puts logic in wrong layer, increases latency
4. **Don't record the check at all**: Breaks hand history replay

### Chosen Approach Benefits

✅ Uses existing action system (`processAction`)  
✅ Records proper hand history (checks are in the database)  
✅ No new action types or special cases  
✅ Works with existing frontend code  
✅ Maintains proper game state throughout  
✅ Replays correctly show what happened

## Testing

### Manual Test

Create a game where one player goes all-in early:

```bash
# Start two players
# Player A raises preflop
# Player B goes all-in
# Player A calls

# Observe that:
# - Flop is dealt automatically
# - Turn is dealt automatically
# - River is dealt automatically
# - Showdown occurs
# - No manual checks required
```

### Verify in Database

```bash
node test_auto_check.js
```

Should show auto-check actions recorded on each street after all-in.

### Replay Test

```bash
node replay_hand.js --room ROOM_CODE
```

Should show check actions on flop/turn/river for the player with chips.

## Edge Cases Handled

- ✅ Multiple all-in players, one with chips
- ✅ Heads-up all-in scenario
- ✅ Side pots with different eligible players
- ✅ Player folds after all-in (still works)
- ✅ Multiple players all-in at different amounts

## Impact on Existing Functionality

- ✅ Normal betting rounds: No change
- ✅ Multiple players with chips: No change
- ✅ Hand history: Enhanced with auto-checks
- ✅ Frontend: No changes required
- ✅ Game rules: Follows proper poker rules

## Related Functions

- `shouldAutoAdvance()` - Detects when auto-advance should occur
- `advanceRound()` - Advances to next betting round
- `processAction()` - Processes player actions
- `recordAction()` - Records actions in database
- `isBettingRoundComplete()` - Checks if betting is done

## Future Enhancements

Potential improvements:

- Add visual indicator in frontend that auto-check occurred
- Add "Auto-check" vs "Check" distinction in hand history display
- Add game option to disable auto-check (for training/teaching scenarios)
