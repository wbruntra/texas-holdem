# Showdown Logic Test Scenarios

## Overview

The pot-manager test suite now includes comprehensive test scenarios for showdown logic with multiple players, all-in situations, and folded players. These tests verify that pot calculations and distributions work correctly in complex scenarios.

## Test Scenario 1: 3 Players with All-In and Fold

### Setup

- **Player 0**: Starts with 100 chips
  - Status: ALL_IN (goes all-in for 100)
  - Hand: Pair of Aces (As, Ah)
- **Player 1**: Starts with 300 chips
  - Status: FOLDED (folds after betting)
  - Total bet: 150 chips
  - Hand: Kd, Qd (irrelevant - folded)
- **Player 2**: Starts with 300 chips
  - Status: ACTIVE (continues to showdown)
  - Total bet: 150 chips
  - Hand: Pair of Kings (Ks, Kh)

### Betting Action

1. Player 0 bets 100 (all-in)
2. Player 1 calls 100
3. Player 2 calls 100
4. Player 1 bets 50 more (total: 150)
5. Player 2 raises 50 (total: 150)
6. Player 1 folds
7. Showdown between Player 0 and Player 2

### Expected Pot Structure

- **Main Pot**: 350 chips
  - Calculation: First 100 from each active player (0, 2) = 200, plus all 150 from folded player 1 = 350
  - Eligible: Players 0 and 2 (folded player 1 cannot win)
- **Side Pot**: 50 chips
  - Calculation: Player 2's additional 50 (150 - 100) = 50
  - Eligible: Only Player 2 (Player 0 is all-in at 100)

### Showdown Results

- **Main Pot Winner**: Player 0 wins 350 chips (Pair of Aces beats Pair of Kings)
- **Side Pot Winner**: Player 2 wins 50 chips (only eligible player)

### Final Chip Distribution

- Player 0: 350 chips (0 + 350 from main pot)
- Player 1: 150 chips (unchanged - folded, gets nothing)
- Player 2: 200 chips (150 remaining + 50 from side pot)
- **Total**: 700 chips (100 + 300 + 300 initial)

### Key Validations

✓ Folded players' contributions go into pots but they cannot win
✓ All-in players are correctly tracked and eligible only for pots they contributed to
✓ Main pot includes folded player contributions
✓ Side pots respect contribution levels
✓ Chip total is conserved (no chips created/destroyed)

---

## Test Scenario 2: All-In with Higher Bettor Folding

### Setup

- **Player 0**: Starts with 100 chips
  - Status: ALL_IN
  - Total bet: 100 chips
  - Hand: As, Ks (strong - A-K = 27 points)
- **Player 1**: Starts with 300 chips
  - Status: FOLDED
  - Total bet: 200 chips
  - Hand: 9h, 8h (weak - doesn't matter, folded)
- **Player 2**: Starts with 300 chips
  - Status: ACTIVE
  - Total bet: 200 chips
  - Hand: Qh, Jh (medium - Q-J = 23 points)

### Expected Pot Structure

- **Main Pot**: 400 chips
  - Calculation: 100 from each active player (0, 2) = 200, plus 200 from folded player 1 = 400
  - Eligible: Players 0 and 2
- **Side Pot**: 100 chips
  - Calculation: Player 2's additional 100 (200 - 100) = 100
  - Eligible: Only Player 2

### Showdown Results

- **Main Pot Winner**: Player 0 wins 400 chips (A-K = 27 beats Q-J = 23)
- **Side Pot Winner**: Player 2 wins 100 chips (only eligible)

### Final Chip Distribution

- Player 0: 400 chips (0 + 400 from main pot)
- Player 1: 100 chips (unchanged)
- Player 2: 200 chips (100 remaining + 100 from side pot)
- **Total**: 700 chips

### Key Validations

✓ Multiple all-in players don't get eligible for pots they didn't contribute to
✓ Side pots correctly limit eligibility
✓ Strongest hand wins the pot they're eligible for

---

## Pot Calculation Logic

The pot manager uses the following algorithm:

1. **Separate active from folded players**
   - Active: ACTIVE status or ALL_IN status
   - Folded: FOLDED status

2. **Sort active players by contribution level (ascending)**

3. **Create pots by contribution levels**
   - For each contribution level, create a pot containing contributions up to that level
   - Eligible players for each pot are those who contributed to that level

4. **Add folded contributions to main pot**
   - All folded player chips go into the first (main) pot
   - But folded players cannot win any pot

5. **Distribute pots**
   - For each pot, evaluate hands of eligible players
   - Award pot to player(s) with best hand

6. **Award chips to winners**
   - Each winner receives their portion of the pot(s)
   - Remainder chips from split pots go to first winner

---

## Running the Tests

```bash
cd backend
bun test ./test/pot-manager.test.js
```

All 16 tests should pass, including the 2 new comprehensive showdown scenarios.
