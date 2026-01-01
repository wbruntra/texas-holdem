# EMALPV Room Analysis - Chip Shortage Investigation

## Executive Summary

**Status:** 🔴 CRITICAL - Chip conservation violation detected

**Current State:**

- Expected total chips: 2000 (1000 each player)
- Actual total chips: 3314 (+1314 extra)
- Game Status: ACTIVE (Hand #4)
- Players: Bill (570 chips), Tom (2744 chips)

## Root Cause

The chips are being **created** during hand payouts, starting from **Hand #2**:

### Hand #1: +30 chips created

- Start: 1970 total
- End: 2000 total (+30)
- Tom wins 746 pot, gains 363 (should gain 333 + 30 for blinds back)

### Hand #2: +1344 chips created ⚠️ MAJOR PROBLEM

- Start: 1970 total
- End: 3314 total (+1344)
- Bill wins 1314 pot but gains 1991 chips total
- **Expected gain: 1314, Actual gain: 1991 (difference: +677)**
- **This is where most chips are created**

### Hand #3: +30 chips created

- Multiple winners (Tom and Bill both listed as winners)
- This is potentially a split pot that was handled twice

### Hand #4: +30 chips created

- Similar pattern

## Hypothesis

The bug appears to be in one of these scenarios:

1. **Blind return + pot payout confusion**: The code might be:
   - Returning blinds to the winner AND
   - Including those same blinds in the "pot amount" payout
   - Causing double-counting

2. **All-in side pot miscalculation**: When calculating side pots with all-in players, the code might be:
   - Including chips that were already counted in the main pot
   - Creating phantom amounts

3. **Stack recording vs. actual payout mismatch**: The `player_stacks_end` might be recorded incorrectly (showing winning amount), while actual pot distribution logic is separate

## Investigation Steps

To fix this, you need to:

1. **Check `completeHandRecord()` in game-service.js**
   - Verify that blind amounts are not being included in pot payout
   - Ensure chips given to winners = sum of all pots, not more

2. **Check `awardPots()` in pot-manager.js**
   - Verify that all-in side pots are calculated correctly
   - Ensure no double-counting of chips

3. **Check the `recordHandHistory()` logic**
   - The `player_stacks_end` seems to be calculated correctly
   - But the actual chip distribution logic must be separate and wrong

4. **Test Reset Button**
   - Verified that reset DOES properly delete hands and actions
   - The frontend reset button seems to work correctly

## Reset Button Status

✅ VERIFIED: The reset button DOES properly delete hands and actions from the database

- The resetGame() function in game-service.js correctly deletes all hands and actions
- No data leakage on reset

## Next Steps

1. Review pot-manager.js distributePots() and awardPots() functions
2. Check how blinds are handled when returning to winners
3. Look for any side pot calculation errors with all-in players
4. Add validation that total chips out = sum of all pots

## Scripts Created

You now have three diagnostic scripts:

1. `bun analyze_hand_history.js <ROOM_CODE>` - Full hand breakdown
2. `bun analyze_chips.js <ROOM_CODE>` - Chip movement tracking
3. `bun analyze_payouts.js <ROOM_CODE>` - Detailed payout analysis
