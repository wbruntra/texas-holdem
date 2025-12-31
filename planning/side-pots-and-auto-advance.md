# Side Pots & Auto-Advance Planning

## Problem Statement

Currently the game doesn't handle:

1. **Side pots** - When a player goes all-in for less than the current bet, they can only win what they contributed from each opponent
2. **Auto-advance** - When betting is complete (everyone all-in or only one player with chips), we should auto-reveal remaining cards
3. **Single player with chips** - If only one player has chips (rest folded/all-in), they should win immediately or betting should stop

## Poker Rules Recap

### Side Pot Basics

- Player A bets $100, Player B has $50 and goes all-in
- **Main pot**: $100 ($50 from each) - B is eligible
- **Side pot**: $50 (A's excess) - only A is eligible
- If C calls $100, side pot becomes $150 (A and C eligible, B not)

### Multiple All-Ins

Example: blinds are 10/20, three players

1. Player A (100 chips) raises to 60
2. Player B (30 chips) goes all-in for 30
3. Player C (150 chips) calls 60

**Main pot**: 90 (30×3) - A, B, C eligible
**Side pot 1**: 60 (30×2) - A, C eligible (B can't win this)

### When Betting is Complete

Betting round ends when:

- All active players have matched the current bet, OR
- All but one player have folded, OR
- All active players are all-in (except possibly one)

If all active players are all-in (or all but one), remaining cards should auto-deal.

## Current State Analysis

### What We Have

- `game.pot` - single number
- `player.currentBet` - what they've put in this round
- `player.totalBet` - what they've put in total this hand
- `player.status` - ACTIVE, FOLDED, ALL_IN
- `advanceRoundIfReady()` - checks if betting round is complete

### What We Need

#### 1. Pot Structure

```javascript
{
  pots: [
    {
      amount: 150,
      eligiblePlayers: [0, 1, 2], // positions
      winners: null // set at showdown
    },
    {
      amount: 60,
      eligiblePlayers: [0, 2], // player 1 was all-in earlier
      winners: null
    }
  ],
  totalPot: 210 // sum for display
}
```

#### 2. Auto-Advance Logic

When should we auto-deal next card?

- All players are all-in OR
- All but one player are folded/all-in (remaining player has acted)

Example scenarios:

- **Scenario A**: 3 players, all go all-in preflop → auto-deal flop, turn, river
- **Scenario B**: 2 players, one all-in, one calls → auto-deal remaining cards
- **Scenario C**: 3 players, one folds, one all-in, one calls → auto-deal remaining cards
- **Scenario D**: 2 players, both active with chips → normal betting on each street

#### 3. Winner Determination with Side Pots

At showdown:

1. Evaluate each pot separately
2. For each pot, find best hand(s) among eligible players
3. Split pot equally among winners
4. Award in order (main pot first, then side pots)

## Implementation Plan

### Phase 1: Side Pot Calculation (Core Logic)

**Files to modify:**

- `backend/lib/pot-manager.js` (NEW)
  - `calculatePots(players)` - given player.totalBet and status, return pot structure
  - `distributePots(pots, playerHands)` - award pots to winners

**Algorithm for calculatePots:**

1. Create array of `{position, amount, status}` for all players
2. Remove folded players (they keep their contributions but can't win)
3. Sort remaining by `amount` ascending
4. For each unique bet amount (starting with smallest):
   - Create pot with `min(remaining, amount) * numEligible`
   - Mark players as eligible if they contributed at least that amount
   - Subtract contribution from each player's remaining

Example:

```
Players: A(100), B(50), C(150), D(30 folded)
After removing D contribution to pot: 30

Sorted active: D=30(folded), B=50, A=100, C=150

Pot 1 (main): 30*3 = 90 (A, B, C eligible) - includes D's contribution
Pot 2: (50-30)*2 = 40 (A, C eligible)
Pot 3: (100-50)*2 = 100 (A, C eligible)
Pot 4: (150-100)*1 = 50 (C only)

If C folded instead, C's chips still in pots but C not eligible to win.
```

### Phase 2: Auto-Advance Detection

**Files to modify:**

- `backend/lib/game-state-machine.js`
  - Add `shouldAutoAdvance(state)` - returns true if no more betting possible
  - Modify `advanceRoundIfReady()` - if shouldAutoAdvance, skip to next round automatically

**shouldAutoAdvance logic:**

```javascript
function shouldAutoAdvance(state) {
  const activePlayers = state.players.filter(
    (p) =>
      p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN
  );

  if (activePlayers.length <= 1) return true;

  const canBet = activePlayers.filter(
    (p) => p.status === PLAYER_STATUS.ACTIVE && p.chips > 0
  );

  // If 0 or 1 players can bet, auto-advance
  if (canBet.length <= 1) {
    // Check if that one player has acted
    if (canBet.length === 1) {
      const player = canBet[0];
      const hasMatched = player.currentBet >= state.currentBet;
      return hasMatched;
    }
    return true;
  }

  return false;
}
```

### Phase 3: Integration

**Files to modify:**

- `backend/services/action-service.js`
  - After action, check `shouldAutoAdvance()` and if true, call `advanceRoundIfReady()` in a loop
- `backend/services/game-service.js`
  - `startNewHand()` - initialize pots structure
  - `advanceRoundIfReady()` - use pot-manager to recalculate pots each round
  - `determineWinners()` - use pot-manager to distribute pots

### Phase 4: UI Updates

**Frontend changes:**

- Display multiple pots if they exist
- Show which players are eligible for each pot
- During auto-advance, show animation or delay between cards
- "Waiting for cards..." message when auto-advancing

## Edge Cases to Handle

### Case 1: Everyone all-in preflop

- Auto-deal all 5 community cards
- Show cards one at a time with delay? Or all at once?

### Case 2: One player with chips, everyone else folded

- Current behavior is correct (they win)

### Case 3: One player with chips, everyone else all-in

- That player should see their hand win immediately after calling
- OR give them option to fold (they can't, but for UI consistency)
- Auto-reveal remaining cards

### Case 4: Player all-in for less than big blind

- They can only win their amount \* number of players
- Rest goes to side pot

### Case 5: Multiple all-ins in one round

- Need to track multiple side pots
- Award pots in order (main first)

## Testing Strategy

Create test cases for:

1. Two players, one all-in
2. Three players, one all-in for middle amount
3. Three players, all all-in for different amounts
4. Player all-in preflop, others call, auto-advance through all streets
5. Side pot winner loses main pot
6. Multiple winners splitting a pot

## Migration Strategy

This is a breaking change to the game state structure. Options:

1. **Version the game state** - add `version` field, handle old format in reads
2. **Require new games** - old games become unplayable (simplest)
3. **One-time migration** - convert `pot` → `pots` on server start

Recommend option 2 (require new games) since this is still in development.

## Open Questions

1. **UI for auto-advance**: Should we show cards one at a time with delays, or all at once?
2. **Skip auto-advance**: Should there be a way to manually trigger "reveal next card"?
3. **Animation timing**: How long between auto-dealt cards?
4. **Side pot display**: Show all pots always, or only when there are multiple?
5. **Pot labels**: "Main pot", "Side pot 1", "Side pot 2" or something else?

## Proposed Timeline

- **Phase 1** (2-3 hours): Implement pot-manager.js with tests
- **Phase 2** (1 hour): Add shouldAutoAdvance logic with tests
- **Phase 3** (2 hours): Integrate into action-service and game-service
- **Phase 4** (2 hours): Update UI to show multiple pots
- **Testing** (1 hour): End-to-end testing of all edge cases

Total: ~8-9 hours of focused work

## Next Steps

1. Review this plan and confirm approach
2. Decide on UI behavior for auto-advance
3. Start with Phase 1: pot-manager.js implementation
4. Write comprehensive tests for pot calculation
5. Integrate step by step, testing at each phase
