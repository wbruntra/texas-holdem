# Texas Hold'em Game - Implementation Plan

## Project Overview
Build a multiplayer Texas Hold'em poker game where:
- **Shared screen** displays the community cards, pot, and player statuses
- **Individual phone screens** show private cards and betting controls
- Players can join games with a simple room code
- Full game state management with proper poker rules

---

## Architecture

### Backend (Express + SQLite)
- REST API for game management
- WebSocket/SSE for real-time updates
- Game state machine for poker logic
- Session management for player authentication

### Frontend (React + Vite)
Two distinct UI modes:
1. **Table View** - Shared screen showing board state
2. **Player View** - Mobile-optimized for individual players

### Shared Package
- TypeScript types/interfaces
- Game constants and enums
- Poker hand evaluation logic

---

## Phase 1: Backend Core (Start Here)

### 1.1 Database Schema

#### Tables to create:

**games**
- `id` (UUID, primary key)
- `room_code` (6-char unique code)
- `status` (waiting, active, completed)
- `small_blind` (integer)
- `big_blind` (integer)
- `current_dealer_position` (integer)
- `current_round` (preflop, flop, turn, river, showdown)
- `pot` (integer - store in cents)
- `community_cards` (JSON array)
- `current_bet` (integer)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**players**
- `id` (UUID, primary key)
- `game_id` (foreign key → games)
- `name` (string)
- `position` (integer, 0-9)
- `chips` (integer)
- `current_bet` (integer)
- `hole_cards` (JSON array, encrypted or server-only)
- `status` (active, folded, all_in, out)
- `session_token` (UUID for authentication)
- `is_dealer` (boolean)
- `is_small_blind` (boolean)
- `is_big_blind` (boolean)
- `last_action` (fold, check, call, raise, all_in)
- `connected` (boolean)
- `created_at` (timestamp)

**hands**
- `id` (UUID, primary key)
- `game_id` (foreign key → games)
- `hand_number` (integer)
- `dealer_position` (integer)
- `winners` (JSON array of player_ids)
- `pot_amount` (integer)
- `community_cards` (JSON array)
- `completed_at` (timestamp)

**actions**
- `id` (UUID, primary key)
- `hand_id` (foreign key → hands)
- `player_id` (foreign key → players)
- `action_type` (fold, check, call, raise, bet, all_in)
- `amount` (integer)
- `round` (preflop, flop, turn, river)
- `created_at` (timestamp)

### 1.2 Game Logic Modules

Create these in `backend/lib/`:

**poker-engine.js**
- `shuffleDeck()` - Create and shuffle 52 cards
- `dealHoleCards(players)` - Deal 2 cards to each player
- `dealFlop()` - Deal 3 community cards
- `dealTurn()` - Deal 1 community card
- `dealRiver()` - Deal 1 community card
- `evaluateHand(cards)` - Determine hand rank (use poker-evaluator library or implement)
- `determineWinners(players, communityCards)` - Find winner(s)
- `distributePot(winners, pot, sidePots)` - Handle pot distribution including side pots

**game-state-machine.js**
- State transitions: waiting → active → completed
- Round transitions: preflop → flop → turn → river → showdown
- Validate actions based on current state
- Handle betting rounds (track current bet, minimum raise, etc.)

**betting-logic.js**
- `validateAction(player, action, amount, gameState)` - Check if action is legal
- `processAction(player, action, amount, gameState)` - Update game state
- `calculateMinBet(gameState)` - Get minimum bet amount
- `calculateMinRaise(gameState)` - Get minimum raise amount
- `handleSidePots(players)` - Calculate side pots for all-in situations

**hand-evaluator.js**
- Rank hands: High Card → Royal Flush
- Compare hands to determine winner
- Handle ties/split pots
- Consider using existing library like `pokersolver` or `phe` (poker-hand-evaluator)

### 1.3 API Endpoints

**Game Management:**
```
POST   /api/games                    - Create new game
GET    /api/games/:roomCode          - Get game by room code
DELETE /api/games/:gameId            - End game (host only)
GET    /api/games/:gameId/state      - Get current game state
```

**Player Management:**
```
POST   /api/games/:gameId/join       - Join game with name
DELETE /api/players/:playerId        - Leave game
PATCH  /api/players/:playerId        - Update player (ready status, etc.)
```

**Game Actions:**
```
POST   /api/games/:gameId/start      - Start game (host only)
POST   /api/games/:gameId/actions    - Submit player action (fold/check/call/raise)
POST   /api/games/:gameId/next-hand  - Start next hand
```

**Real-time Updates:**
```
GET    /api/games/:gameId/events     - SSE endpoint for real-time updates
```

### 1.4 Authentication Strategy

Simple token-based auth:
- When player joins, generate a UUID session token
- Store in cookie or localStorage
- Include in all requests
- Backend validates token matches player_id for that game

### 1.5 Real-time Updates

Two options:

**Option A: Server-Sent Events (SSE)** - Simpler
- Players subscribe to `/api/games/:gameId/events`
- Server pushes updates when game state changes
- Works with standard HTTP

**Option B: WebSocket** - More complex but bidirectional
- Use `ws` or `socket.io`
- Allows instant bidirectional communication
- Better for very responsive UI

**Recommendation:** Start with SSE for simplicity, can upgrade to WebSocket later.

---

## Phase 2: Poker Game Rules Implementation

### 2.1 Card Representation
```javascript
// Use simple objects
{ rank: 'A', suit: 'hearts' }  // Ace of Hearts
{ rank: 'K', suit: 'spades' }  // King of Spades

// Or use string notation
'Ah', 'Ks', '2c', '7d'
```

### 2.2 Hand Rankings (Highest to Lowest)
1. Royal Flush (A-K-Q-J-10, same suit)
2. Straight Flush (5 sequential cards, same suit)
3. Four of a Kind (4 cards of same rank)
4. Full House (3 of a kind + pair)
5. Flush (5 cards same suit)
6. Straight (5 sequential cards)
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

### 2.3 Betting Round Flow
1. Dealer button rotates clockwise
2. Small blind (left of dealer) posts small blind
3. Big blind (left of small blind) posts big blind
4. Deal 2 hole cards to each player
5. **Preflop betting** - Starts left of big blind
6. Deal 3 community cards (flop)
7. **Flop betting** - Starts left of dealer
8. Deal 1 community card (turn)
9. **Turn betting**
10. Deal 1 community card (river)
11. **River betting**
12. **Showdown** - Determine winner(s)
13. Distribute pot
14. Start new hand

### 2.4 Action Validation Rules
- First to act: Can bet or check
- After a bet: Can fold, call, or raise
- Raise must be at least double the previous bet
- All-in: Player bets all remaining chips
- Side pots: When players are all-in with different amounts

### 2.5 Edge Cases to Handle
- Player disconnects during hand
- Multiple side pots
- Multiple players all-in
- Chopped pots (tied hands)
- Player runs out of chips
- Only one player remains (winner)
- Minimum 2 players to start game

---

## Phase 3: Testing Strategy

### 3.1 Unit Tests
Test individual poker functions:
- Hand evaluation accuracy
- Pot calculation
- Side pot calculations
- Action validation
- State transitions

### 3.2 Integration Tests
Test API endpoints:
- Create game flow
- Join game flow
- Complete hand flow
- Multiple players actions
- Edge cases (disconnects, all-ins)

### 3.3 Manual Testing Checklist
- [ ] Create game and get room code
- [ ] Multiple players join with different devices
- [ ] Start game and deal cards
- [ ] Each player sees only their cards
- [ ] Betting round works correctly
- [ ] Flop/turn/river dealt correctly
- [ ] Winner determined correctly
- [ ] Pot distributed correctly
- [ ] Next hand starts correctly
- [ ] Player can leave game
- [ ] Game handles disconnects

---

## Phase 4: Frontend Implementation (After Backend)

### 4.1 Table View (Shared Screen)
**Components:**
- GameBoard - Main container
- CommunityCards - Shows flop/turn/river
- PotDisplay - Current pot amount
- PlayerSeats - Ring of player positions showing:
  - Player name
  - Chip count
  - Current bet
  - Status (active/folded/all-in)
  - Dealer button indicator
  - Blind indicators
  - Last action
- CurrentPlayerIndicator - Highlight whose turn

**Features:**
- Read-only view (no controls)
- Auto-refreshes on state changes (SSE)
- Shows animations for actions
- Large, readable from distance
- Fullscreen mode

### 4.2 Player View (Mobile)
**Screens:**

1. **Join Screen**
   - Enter room code
   - Enter player name
   - Join button

2. **Waiting Screen**
   - Show joined players
   - "Waiting for game to start" message
   - Show room code
   - Ready button

3. **Game Screen**
   - Hole cards display (large, easy to see)
   - Your chip count
   - Current pot
   - Current bet to call
   - Action buttons:
     - Fold
     - Check (if no bet)
     - Call (if there's a bet)
     - Raise (with amount slider/input)
     - All-in
   - Betting slider for raise amount
   - Disable controls when not your turn
   - Show "Your turn" notification

4. **Hand Result Screen**
   - Show your hand
   - Show winning hand(s)
   - Chips won/lost
   - "Next hand" button (dealer only)

### 4.3 Routing
```
/                          - Landing page (choose table or player view)
/table/:roomCode           - Table view
/join                      - Enter room code
/player/:gameId            - Player view (after joining)
```

---

## Phase 5: Polish & Features

### 5.1 Essential Features
- [ ] Show hand history
- [ ] Configurable blinds at game creation
- [ ] Configurable starting chips
- [ ] Show timer for player turns
- [ ] Sound effects for actions
- [ ] Vibration on mobile for "your turn"
- [ ] Reconnection handling

### 5.2 Nice-to-Have Features
- [ ] Chat between players
- [ ] Hand replay/review
- [ ] Statistics (hands won, biggest pot, etc.)
- [ ] Customizable table themes
- [ ] Tournament mode (eliminations)
- [ ] Blind increase timer for tournaments
- [ ] Spectator mode
- [ ] Save/resume games

---

## Implementation Order

### Sprint 1: Core Backend (Week 1)
1. Create database migrations for all tables
2. Implement poker-engine.js (deck, dealing, hand evaluation)
3. Implement game-state-machine.js
4. Implement betting-logic.js
5. Create basic API endpoints (create game, join game)

### Sprint 2: Game Flow (Week 1-2)
1. Implement action endpoints
2. Add SSE for real-time updates
3. Complete full hand lifecycle (preflop → showdown)
4. Handle pot distribution and side pots
5. Test with manual API calls (Postman/curl)

### Sprint 3: Testing & Refinement (Week 2)
1. Write unit tests for poker logic
2. Write integration tests for API
3. Fix bugs and edge cases
4. Add comprehensive logging
5. Document API endpoints

### Sprint 4: Frontend - Table View (Week 3)
1. Create GameBoard component
2. Implement real-time state updates
3. Display community cards and pot
4. Show player positions and statuses
5. Style for large display

### Sprint 5: Frontend - Player View (Week 3-4)
1. Create join flow
2. Implement player game screen
3. Add action controls (fold/check/call/raise)
4. Show hole cards securely
5. Mobile-responsive design

### Sprint 6: Polish (Week 4)
1. Add animations and transitions
2. Improve error handling and messaging
3. Add sound effects
4. Performance optimization
5. Cross-device testing

---

## Technical Dependencies to Add

### Backend
```json
{
  "poker-evaluator": "^1.0.0",      // or "pokersolver": "^2.1.4"
  "uuid": "^9.0.0",
  "ws": "^8.0.0",                    // if using WebSocket
  "joi": "^17.0.0"                   // for input validation
}
```

### Frontend (already has React, Bootstrap)
```json
{
  "react-router-dom": "^6.0.0",      // routing
  "zustand": "^4.0.0",               // state management (lighter than Redux)
  "react-query": "^3.0.0",           // server state management
  "framer-motion": "^10.0.0"         // animations
}
```

---

## Security Considerations

1. **Prevent cheating:**
   - Never send other players' hole cards to client
   - Validate all actions server-side
   - Use session tokens to verify player identity

2. **Input validation:**
   - Validate all bet amounts
   - Sanitize player names
   - Rate limit API requests

3. **Game state integrity:**
   - Store all actions in database
   - Validate state transitions
   - Never trust client-side calculations

---

## Database Migrations Order

1. `create_games_table.js`
2. `create_players_table.js`
3. `create_hands_table.js`
4. `create_actions_table.js`

---

## API Response Formats

### Game State Response
```json
{
  "id": "uuid",
  "roomCode": "ABC123",
  "status": "active",
  "currentRound": "flop",
  "pot": 150,
  "currentBet": 50,
  "communityCards": ["Ah", "Kd", "Qs"],
  "players": [
    {
      "id": "uuid",
      "name": "Alice",
      "position": 0,
      "chips": 950,
      "currentBet": 50,
      "status": "active",
      "isDealer": true,
      "lastAction": "raise"
    }
  ],
  "currentPlayerPosition": 1,
  "blinds": {
    "small": 5,
    "big": 10
  }
}
```

### Player Private State Response
```json
{
  "id": "uuid",
  "holeCards": ["As", "Ad"],
  "chips": 950,
  "canCheck": false,
  "canCall": true,
  "canRaise": true,
  "callAmount": 50,
  "minRaise": 100,
  "maxRaise": 950
}
```

---

## Notes

- Start simple: Get basic game working with 2-3 players first
- Test frequently: Each betting round should be tested independently
- Use existing poker libraries: Don't reinvent hand evaluation
- Mobile-first for player view: Most players will use phones
- Large UI for table view: Needs to be visible across a room
- Keep it fun: Add personality with animations, sounds, and good UX

---

## Questions to Consider

1. **Starting chips:** 1000? 5000? Configurable?
2. **Blind structure:** Fixed or increase over time?
3. **Player limits:** Min 2, max 10?
4. **Time limits per action:** Optional timer to prevent slow play?
5. **Buy-in/rebuy:** Can players buy more chips mid-game?
6. **Host controls:** Should game creator have special powers?

---

## Next Steps

1. Review this plan and adjust as needed
2. Create database migrations
3. Implement poker-engine core functions
4. Build out API endpoints one at a time
5. Test each feature thoroughly before moving on
6. Get a full hand working end-to-end before building UI

Let's start with the database schema and core poker engine!
