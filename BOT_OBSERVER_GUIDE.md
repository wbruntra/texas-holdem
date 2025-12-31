# Bot Observer Script - Complete Workflow

This script allows you to create a poker game and have two bots play against each other while you observe the action in real-time on the table display.

## Quick Start

### 1. Create a Test Game

```bash
bun create_test_game.js
```

Output:
```
✅ Game created!
   Room Code: BGEJSE
   Game ID: b163acbd-...

📝 To run bots, use:
   bun bots_play.js BGEJSE

🌐 To observe, visit:
   http://localhost:5173/table/BGEJSE
```

### 2. Run the Bots

In a separate terminal, run the bots script with the room code:

```bash
bun bots_play.js BGEJSE
```

### 3. Watch the Game

Open your browser to the table view URL from step 1:
```
http://localhost:5173/table/BGEJSE
```

## What the Bots Do

### Bot 1: "Aggressive"
- Always tries to bet **$100** per round
- Raises when possible
- Attempts to dominate the game through aggressive betting

### Bot 2: "Conservative"  
- Prefers to check when possible
- Calls larger bets but won't initiate them
- Plays a passive strategy

## Bot Script Features

✅ **Automatic Game Start** - Joins both bots and starts the game  
✅ **Multi-hand Play** - Plays multiple hands automatically  
✅ **All-in Detection** - Automatically reveals community cards when players go all-in  
✅ **Hand Advancement** - Moves to next hand when current hand completes  
✅ **Chip Tracking** - Shows chip counts after each hand  
✅ **Visible Delays** - 1-2 second delays between actions for observability  
✅ **Game Completion** - Stops when one player has all chips  

## Example Game Output

```
🤖 Bot Game Observer - Room: BGEJSE
Bot 1: "Aggressive" (bets $100)
Bot 2: "Conservative" (calls/checks)

🔗 Connecting bot 1 (aggressive)...
✅ AggressiveBot joined at position 0
🔗 Connecting bot 2 (conservative)...
✅ ConservativeBot joined at position 1

⏳ Game is waiting to start. Starting game...
✅ Game started!

--- Hand #1 ---
AggressiveBot: $995 | ConservativeBot: $990
Round: preflop
🤖 AggressiveBot (aggressive) raises by $100
🤖 ConservativeBot (conservative) calls $100
🤖 ConservativeBot (conservative) checks
🤖 AggressiveBot (aggressive) bets $100
🤖 ConservativeBot (conservative) calls $100

🏆 Showdown reached! Advancing to next hand...
✅ Hand advanced. Starting next hand...

--- Hand #2 ---
AggressiveBot: $1400 | ConservativeBot: $585
...

============================================================
🏁 GAME OVER!
============================================================
  AggressiveBot: $1980
  ConservativeBot: $0
============================================================
```

## Frontend Display

### During Play
- **Table View** (`/table/{roomCode}`)
  - Shows all player positions and chip stacks
  - Displays current bet and pot
  - Shows community cards as they're dealt
  - Indicates whose turn it is
  - Displays last action taken

### Game Over
- **Full-screen overlay** with:
  - Large "🏆 GAME OVER!" message
  - Final chip counts for all players
  - Gold border and text highlighting the winner
  - Room code for reference

## Customization

### Change Bet Size

Edit `bots_play.js` and modify these lines:

```javascript
// For aggressive bot (search for these)
if (validActions.canBet && botPlayer.chips >= 100) {
  amount = 100;  // Change this number
}

// Update the comment too
console.log('Bot 1: "Aggressive" (bets $100)');  // Change to your amount
```

### Change Starting Chips

Edit `create_test_game.js`:

```javascript
const gameRes = await api.post('/games', {
  smallBlind: 5,
  bigBlind: 10,
  startingChips: 1000  // Change this to increase/decrease starting chips
});
```

### Modify Bot Strategy

Edit the bot strategy section in `bots_play.js`:

```javascript
if (bot.strategy === 'aggressive') {
  // Aggressive bot logic here
} else {
  // Conservative bot logic here
}
```

## Troubleshooting

### Bots not starting game
- Ensure backend is running on `http://localhost:3660`
- Check that both bots successfully join (look for "✅" messages)

### Game seems stuck
- Frontend may need a refresh
- Check browser console for errors
- Verify backend is still running

### Performance issues
- Increase delays in `bots_play.js` sleep() calls
- Reduce polling frequency in TableView component

## API Endpoints Used

- `POST /api/games` - Create a new game
- `GET /api/games/room/{roomCode}` - Get game by room code
- `POST /api/games/{gameId}/join` - Bot joins the game
- `POST /api/games/{gameId}/start` - Start the game
- `GET /api/games/{gameId}/actions/valid` - Check valid moves
- `POST /api/games/{gameId}/actions` - Submit an action
- `POST /api/games/{gameId}/reveal-card` - Reveal next community card
- `POST /api/games/{gameId}/next-hand` - Advance to next hand

## Files

- `create_test_game.js` - Creates a new game and outputs the room code
- `bots_play.js` - Main bot controller script
- `backend/scripts/bot-player.js` - Original single-bot player script
- Frontend: `frontend/src/pages/TableView.tsx` - Table display with game-over overlay
