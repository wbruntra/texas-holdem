# Hand Recording and Replay System - Complete Implementation

## Overview

The poker game now has a complete hand recording and replay system that captures every detail of each hand, allowing for accurate reconstruction and analysis of gameplay.

## Database Schema

### Tables Involved

1. **games** - Game configuration and current state
2. **hands** - Individual hand records with complete game state
3. **players** - Player information and current chip stacks
4. **actions** - Every action taken during each hand

### Key Hand Record Fields

```javascript
{
  id: 8,
  game_id: 11,
  hand_number: 3,
  dealer_position: 0,

  // Complete deck state
  deck: "[{rank, suit, value}, ...]",  // 52 cards in shuffled order

  // Player information
  player_hole_cards: "{player_id: [card1, card2], ...}",
  player_stacks_start: "[{player_id, position, name, chips}, ...]",
  player_stacks_end: "[{player_id, position, chips}, ...]",

  // Board cards
  community_cards: "[{rank, suit, value}, ...]",  // 5 cards max

  // Results
  winners: "[position1, position2, ...]",
  pot_amount: 1701,
  pots: "[{amount, eligiblePlayers, winners, winAmount, winningRankName}, ...]",

  // Metadata
  small_blind: 20,
  big_blind: 40,
  completed_at: 1767254260096,
  created_at: "2026-01-01 07:56:52"
}
```

### Action Records

```javascript
{
  id: 37,
  hand_id: 8,
  player_id: 15,
  action_type: "raise",  // fold, check, call, bet, raise
  amount: 40,
  round: "preflop",  // preflop, flop, turn, river
  sequence_number: 1,  // Ensures proper ordering
  created_at: "2026-01-01 07:57:13"
}
```

## Implementation Details

### Hand Lifecycle

1. **Hand Start** (`createHandRecord`)
   - Records initial state at hand start
   - Captures deck, player positions, blinds
   - Creates record in `hands` table

2. **Action Recording** (`recordAction`)
   - Each player action is recorded with sequence number
   - Captures action type, amount, round, timestamp
   - Stored in `actions` table

3. **Hand Completion** (`completeHandRecord`)
   - Updates hand record with final state
   - Captures community cards, winners, pots
   - Records player stack changes
   - Marks hand as completed

### Sequence Numbers

Actions use `sequence_number` to ensure correct ordering even if timestamps are identical:

```javascript
const lastAction = await db('actions')
  .where({ hand_id: hand.id })
  .orderBy('sequence_number', 'desc')
  .first()

const sequenceNumber = lastAction ? lastAction.sequence_number + 1 : 1
```

### Auto-Check for All-In Scenarios

When only one player can act (others all-in), the system automatically:

1. Detects the situation via `shouldAutoAdvance()`
2. Processes a check action via `processAction()`
3. Records the check in database via `recordAction()`
4. Advances to next round automatically

This ensures:

- ✅ No manual checking required when it's meaningless
- ✅ Complete hand history preserved
- ✅ Proper game flow maintained

## Replay Tools

### 1. Full Hand Replay

```bash
node replay_hand.js --room YGPN4P
node replay_hand.js --room YGPN4P --hand 2
node replay_hand.js --hand-id 6
```

Features:

- Colorized output with card suits
- Action-by-action playback
- Board card reveals
- Winner determination
- Stack changes

### 2. Game Summary

```bash
node summarize_game.js YGPN4P
```

Features:

- Quick overview of all hands
- Winner summaries
- Stack progression
- Final standings with medals

### 3. Investigation Tools

```bash
node investigate_hand.js 8
node investigate_game.js YGPN4P
```

For deep debugging of specific hands or games.

## Example Hand History

```
♠ ♥ ♣ ♦  HAND REPLAY - Game YGPN4P - Hand #3  ♦ ♣ ♥ ♠

Starting Stacks
  bill (P0): $780
  james (P1): $1160

Hole Cards
  bill (P0): [7♣ J♦]
  james (P1): [8♦ 5♦]

Action Sequence
 PRE-FLOP
  bill (P0): RAISE $40
  james (P1): RAISE $821
  bill (P0): CALL

 FLOP
  Board: [8♣ 5♠ 5♣]
  james (P1): CHECK

 RIVER
  Board: [8♣ 5♠ 5♣ 10♥ A♠]
  james (P1): CHECK

Showdown
  Final Board: [8♣ 5♠ 5♣ 10♥ A♠]

Results
  Pot 1: $1600
    WINNER: james (P1) wins $1600 with Full House
  Pot 2: $101
    WINNER: james (P1) wins $101 with Full House

Ending Stacks
  bill (P0): $0 (-780)
  james (P1): $2000 (+840)
```

## Use Cases

### 1. Game Analysis

- Review hand histories
- Study betting patterns
- Identify mistakes

### 2. Debugging

- Reproduce reported bugs
- Verify game logic
- Test edge cases

### 3. Training/Learning

- Replay hands step-by-step
- Understand poker situations
- Learn from mistakes

### 4. Tournament Records

- Maintain complete tournament history
- Generate statistics
- Create highlights

## Technical Decisions

### Why Store Complete Deck?

Storing the shuffled deck allows perfect hand reconstruction and enables:

- Verification of dealing fairness
- "What if" analysis (what would next card be?)
- Exact replay without RNG dependencies

### Why Separate Actions Table?

Separate action records enable:

- Detailed hand history replay
- Action-by-action analysis
- Statistical queries (VPIP, PFR, etc.)
- Proper sequencing with timestamps

### Why Store Both Start and End Stacks?

Redundant but valuable for:

- Quick stack change calculations
- Data validation (changes match pot)
- Corruption detection
- Fast queries without reconstruction

## Performance Considerations

- Indexes on `hand_id` for fast action lookup
- JSON storage for complex structures (pots, cards)
- Batch inserts during hand completion
- Lazy loading for replay (one hand at a time)

## Future Enhancements

Potential additions:

- [ ] Export to PGN (Portable Game Notation)
- [ ] HTML/web-based replay viewer
- [ ] Statistical analysis (VPIP, PFR, AF)
- [ ] Hand comparison tools
- [ ] Session/tournament summaries
- [ ] Video export
- [ ] Hand strength analysis
- [ ] GTO solver integration

## Related Documentation

- [REPLAY_TOOLS.md](REPLAY_TOOLS.md) - Replay utility documentation
- [AUTO_CHECK_FIX.md](AUTO_CHECK_FIX.md) - Auto-check implementation
- [tables/](tables/) - Database schema DDL files
