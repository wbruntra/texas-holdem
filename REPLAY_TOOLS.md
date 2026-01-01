# Hand Replay & Analysis Utilities

This directory contains utilities for replaying and analyzing poker hands from the database.

## 📊 Available Utilities

### 1. `replay_hand.js` - Full Hand Replay

Provides a detailed, colorized replay of poker hands showing every action, card dealt, and result.

**Usage:**

```bash
# Replay all hands in a game
node replay_hand.js --room YGPN4P

# Replay a specific hand number
node replay_hand.js --room YGPN4P --hand 2

# Replay by hand ID
node replay_hand.js --hand-id 6

# Show help
node replay_hand.js --help
```

**Features:**

- ♠️ Colorized card display with suit symbols
- 💰 Chip amounts with currency formatting
- 🎬 Action-by-action playback
- 🏆 Winner determination with hand rankings
- 📊 Stack changes before/after

**Example Output:**

```
♠ ♥ ♣ ♦  HAND REPLAY - Game YGPN4P - Hand #1  ♦ ♣ ♥ ♠
========================================================================

Starting Stacks
  bill (P0): $980
  james (P1): $960

Hole Cards
  bill (P0): [4♠ 2♥]
  james (P1): [A♦ K♣]

Action Sequence
PRE-FLOP
  bill (P0): RAISE $40
  james (P1): RAISE $40
  bill (P0): CALL

FLOP
  Board: [10♣ 4♦ 10♠]
  james (P1): CHECK
  bill (P0): BET $40
  james (P1): CALL

...
```

### 2. `summarize_game.js` - Game Summary

Provides a quick overview of all hands in a game with winners and stack changes.

**Usage:**

```bash
node summarize_game.js ROOM_CODE
```

**Features:**

- 🎯 Quick game overview
- 🏅 Winner summaries per hand
- 📈 Stack progression tracking
- 🏆 Final standings with medals

**Example Output:**

```
═══════════════════════════════════════════════════
  Game Summary: YGPN4P
═══════════════════════════════════════════════════

Players:
  • bill (Position 0)
  • james (Position 1)

Hand #1 (10 actions)
  Winner: james won $560 with Two Pair
  Stack changes:
    bill: $980 → $720 (-$260)
    james: $960 → $1280 (+$320)

Final Standings:
  🥇 james: $2000 (+$1000)
  🥈 bill: $0 (-$1000)
```

### 3. `investigate_hand.js` - Hand Investigation

Deep dive into a specific hand's database records.

**Usage:**

```bash
node investigate_hand.js HAND_ID
```

### 4. `investigate_game.js` - Game Investigation

Examine all database records for a game.

**Usage:**

```bash
node investigate_game.js ROOM_CODE
```

## 🎨 Color Coding

The replay utilities use ANSI colors for better readability:

- **Cards:**
  - ♥♦ Red suits (hearts, diamonds)
  - ♣♠ White suits (clubs, spades)

- **Actions:**
  - 🟢 CALL (green)
  - 🟡 BET/RAISE (yellow/red)
  - ⚪ CHECK (white)
  - 🔴 ALL-IN (red background)

- **Chips:**
  - 💰 Yellow currency display

- **Results:**
  - 🟢 Winnings (green)
  - 🔴 Losses (red)

## 📁 Database Schema

The replay system uses the following tables:

- **games** - Game state and configuration
- **hands** - Individual hand records with deck, community cards, and results
- **players** - Player information and current stacks
- **actions** - Every action taken during each hand

Each hand stores:

- `deck` - The shuffled deck used
- `player_hole_cards` - Each player's private cards
- `community_cards` - The board cards
- `player_stacks_start` - Chips at hand start
- `player_stacks_end` - Chips at hand end
- `pots` - All pots with winners and hand rankings
- All actions are stored with `sequence_number` for proper ordering

## 🔍 Use Cases

**Game Analysis:**

```bash
# Get overview of entire game
node summarize_game.js YGPN4P

# Deep dive into specific hand
node replay_hand.js --room YGPN4P --hand 3
```

**Debugging:**

```bash
# Investigate hand data
node investigate_hand.js 8

# Check game state
node investigate_game.js YGPN4P
```

**Training/Learning:**

```bash
# Replay hands one by one to study play
node replay_hand.js --room YGPN4P
# (press Enter between hands)
```

## 🚀 Future Enhancements

Potential additions:

- Export to PGN (Portable Game Notation) format
- HTML/web-based replay viewer
- Statistical analysis (VPIP, PFR, etc.)
- Hand comparison tools
- Session/tournament summaries
- Export to video format

## 📝 Notes

- All utilities automatically close the database connection on exit
- Times are stored in UTC and displayed as-is
- Stack amounts are in chip units (not currency)
- Sequence numbers ensure proper action ordering even with identical timestamps
