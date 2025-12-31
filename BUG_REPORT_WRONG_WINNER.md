# Bug Report: Wrong Winner at Showdown (Game 7VRRNC)

## Summary

In game **7VRRNC**, the system declared an incorrect winner at showdown. BotPlayer won the pot despite having a weaker hand than bill.

## Game State

- **Player 0 (bill)**: 6♦ 9♣
- **Player 1 (BotPlayer)**: 5♦ 7♣
- **Community Cards**: 3♠ J♠ 10♣ 4♥ 9♠

## Actual Hand Rankings

- **bill**: Pair of 9s (Rank: 2, Value: 1,011,006) ✓ SHOULD WIN
- **BotPlayer**: High Card Jack (Rank: 1, Value: 1,110,090,705) ✗ LOST

## Root Cause

In [backend/lib/pot-manager.js](backend/lib/pot-manager.js#L96), the `distributePots()` function was comparing hands using **only the numeric `value`** without checking the **`rank` first**.

### Buggy Code (Lines 96-101)

```javascript
// WRONG: Only comparing numeric values
const bestValue = Math.max(...evaluations.map((e) => e.hand.value));
const winners = evaluations
  .filter((e) => e.hand.value === bestValue)
  .map((e) => e.position);
```

### Why This Fails

The `value` field is designed as a tiebreaker WITHIN the same rank:

- Pair of 9s: value = `1,011,006` (pair rank is 2)
- High Card: value = `1,110,090,705` (high card rank is 1)

When comparing only by value, high card (1.1B) > pair of 9s (1M), so it incorrectly wins despite having a lower rank.

## The Fix

Changed the comparison logic to use `compareHands()` which correctly compares rank first, then uses value as a tiebreaker:

```javascript
// CORRECT: Compare rank first, then value as tiebreaker
let bestHand = evaluations[0].hand;
for (let i = 1; i < evaluations.length; i++) {
  const comp = compareHands(evaluations[i].hand, bestHand);
  if (comp > 0) {
    bestHand = evaluations[i].hand;
  }
}

const winners = evaluations
  .filter((e) => compareHands(e.hand, bestHand) === 0)
  .map((e) => e.position);
```

## Changed Files

- [backend/lib/pot-manager.js](backend/lib/pot-manager.js)
  - Added import: `const { compareHands } = require('./poker-engine');`
  - Updated `distributePots()` function to use proper hand comparison

## Testing

- ✅ pot-manager.test.js: 14 tests passed
- ✅ game-state.test.js: 33 tests passed

## Impact

- Fixes showdown winner determination
- Ensures proper chip distribution to correct winners
- Works correctly with side pots and multiple all-in scenarios
