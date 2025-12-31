# Short Stack All-In Feature Implementation

## Problem

When a player's remaining stack is smaller than the current bet, they couldn't call and be put all-in. This prevented proper side pot creation for crucial poker scenarios.

## Example Scenario

- Alice bets $500
- Bob only has $200 left in his stack
- Previously: Bob would have to fold or manually go all-in
- Now: Bob can call with his remaining $200 and automatically go all-in, creating side pots

## Implementation Details

### 1. Updated Validation Logic (`betting-logic.js`)

**Before**: Call was rejected if `player.chips < callAmount`

```javascript
// WRONG: Too restrictive
if (player.chips < callAmount) {
  return { valid: false, error: 'Not enough chips to call, must go all-in' }
}
```

**After**: Call is allowed as long as player has any chips

```javascript
// CORRECT: Allow call even with short stack
if (player.chips === 0) {
  return { valid: false, error: 'No chips to call' }
}
return { valid: true }
```

### 2. Fixed `getValidActions()` Function

**Before**:

```javascript
const canCall = callAmount > 0 && player.chips >= callAmount
```

**After**: Changed to allow calls with any remaining chips

```javascript
const canCall = callAmount > 0 && player.chips > 0
const actualCallAmount = Math.min(callAmount, player.chips)
```

### 3. Existing Call Processing Already Correct

The `processAction()` function already handled this correctly:

```javascript
case ACTION_TYPE.CALL: {
  const callAmount = state.currentBet - player.currentBet;
  const actualCall = Math.min(callAmount, player.chips); // Takes only what's available
  player.chips -= actualCall;
  player.currentBet += actualCall;
  // ...
  if (player.chips === 0) {
    player.status = PLAYER_STATUS.ALL_IN;
  }
}
```

## Side Pot Creation

When a short-stacked player calls all-in, the existing `calculatePots()` function automatically creates side pots:

```
Example: Alice bets $500, Bob has only $200
Main Pot:   $400 (Alice $200 + Bob $200) - Both eligible
Side Pot:   $300 (Alice $300 only) - Alice only eligible
```

## Changes Made

### Files Modified:

1. **backend/lib/betting-logic.js**
   - Updated CALL validation to allow short-stack calls
   - Modified `getValidActions()` to report correct call amount for short stacks
   - Changed `canCall` condition from `player.chips >= callAmount` to `player.chips > 0`

### Tests Added:

1. **backend/test/game-state.test.js**
   - `allows call when stack is smaller than bet amount`
   - `processes call going all-in with short stack`
   - `getValidActions shows correct callAmount for short stack`

2. **backend/test/short-stack-all-in.test.js**
   - Complete end-to-end test showing side pot creation

## Validation

All 78 tests pass:

- game-state.test.js: 38 tests ✅
- pot-manager.test.js: 14 tests ✅
- poker-engine.test.js: 26 tests ✅
- short-stack-all-in.test.js: 1 test ✅

## Benefits

- ✅ Players can properly go all-in on calls
- ✅ Side pots are created automatically
- ✅ Correct chip distribution to winners across multiple pots
- ✅ Matches standard Texas Hold'em rules
- ✅ No breaking changes to existing code
