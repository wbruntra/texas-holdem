# Texas Hold'em API Documentation

Base URL: `http://localhost:3660/api`

## Authentication

All authenticated endpoints require a session cookie. Sessions are established when:
- Joining a game (`POST /games/:gameId/join`)
- Authenticating with existing credentials (`POST /games/:gameId/auth`)

## Endpoints

### Health Check

**GET /health**

Check if API is running.

**Response:**
```json
{
  "health": "OK"
}
```

---

### Create Game

**POST /games**

Create a new poker game.

**Request Body:**
```json
{
  "smallBlind": 5,      // optional, default: 5
  "bigBlind": 10,       // optional, default: 10
  "startingChips": 1000 // optional, default: 1000
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "roomCode": "ABC123",  // 6-character code for joining
  "status": "waiting",
  "smallBlind": 5,
  "bigBlind": 10,
  "startingChips": 1000
}
```

---

### Get Game by Room Code

**GET /games/room/:roomCode**

Get public game information (no authentication required).

**Response (200):**
```json
{
  "id": "uuid",
  "roomCode": "ABC123",
  "status": "waiting",
  "smallBlind": 5,
  "bigBlind": 10,
  "startingChips": 1000,
  "players": [
    {
      "name": "Alice",
      "position": 0,
      "chips": 1000,
      "connected": true
    }
  ]
}
```

---

### Join Game

**POST /games/:gameId/join**

Join a game with a username and password. Sets session cookie.

**Request Body:**
```json
{
  "name": "Alice",
  "password": "mypassword"  // min 4 characters
}
```

**Response (201):**
```json
{
  "player": {
    "id": "uuid",
    "name": "Alice",
    "position": 0,
    "chips": 1000,
    "gameId": "uuid"
  },
  "message": "Joined game successfully"
}
```

**Errors:**
- `400` - Name or password missing
- `400` - Password too short
- `400` - Player name already taken
- `400` - Game already started
- `400` - Game is full (10 players max)
- `404` - Game not found

---

### Authenticate

**POST /games/:gameId/auth**

Re-authenticate with existing credentials (for reconnecting). Sets session cookie.

**Request Body:**
```json
{
  "name": "Alice",
  "password": "mypassword"
}
```

**Response (200):**
```json
{
  "player": {
    "id": "uuid",
    "name": "Alice",
    "position": 0,
    "chips": 995,
    "gameId": "uuid"
  },
  "message": "Authenticated successfully"
}
```

**Errors:**
- `401` - Invalid credentials
- `404` - Game not found

---

### Get Game State

**GET /games/:gameId**

Get full game state. Requires authentication. Only shows authenticated player's hole cards.

**Response (200):**
```json
{
  "id": "uuid",
  "roomCode": "ABC123",
  "status": "active",
  "currentRound": "flop",
  "pot": 30,
  "communityCards": [
    {"rank": "A", "suit": "hearts", "value": 14},
    {"rank": "K", "suit": "spades", "value": 13},
    {"rank": "Q", "suit": "diamonds", "value": 12}
  ],
  "currentBet": 10,
  "currentPlayerPosition": 1,
  "dealerPosition": 0,
  "handNumber": 1,
  "players": [
    {
      "id": "uuid",
      "name": "Alice",
      "position": 0,
      "chips": 990,
      "currentBet": 10,
      "holeCards": [  // Only visible for authenticated player
        {"rank": "J", "suit": "clubs", "value": 11},
        {"rank": "10", "suit": "hearts", "value": 10}
      ],
      "status": "active",
      "isDealer": true,
      "isSmallBlind": true,
      "isBigBlind": false,
      "lastAction": "call",
      "connected": true
    },
    {
      "id": "uuid",
      "name": "Bob",
      "position": 1,
      "chips": 980,
      "currentBet": 10,
      "holeCards": [],  // Hidden for other players
      "status": "active",
      "isDealer": false,
      "isSmallBlind": false,
      "isBigBlind": true,
      "lastAction": "raise",
      "connected": true
    }
  ]
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not authorized for this game
- `404` - Game not found

---

### Start Game

**POST /games/:gameId/start**

Start the game (requires at least 2 players). Requires authentication.

**Response (200):**
Returns full game state (same as GET /games/:gameId)

**Errors:**
- `401` - Not authenticated
- `403` - Not authorized for this game
- `400` - Need at least 2 players
- `400` - Game already started
- `404` - Game not found

---

### Submit Action

**POST /games/:gameId/actions**

Submit a player action. Requires authentication.

**Request Body:**
```json
{
  "action": "call",  // fold, check, call, bet, raise, all_in
  "amount": 20       // optional, required for bet/raise
}
```

**Response (200):**
Returns updated game state (same format as GET /games/:gameId)

**Errors:**
- `401` - Not authenticated
- `403` - Not authorized for this game
- `400` - Action required
- `400` - Not your turn
- `400` - Invalid action for current state
- `404` - Game not found

---

### Get Valid Actions

**GET /games/:gameId/actions/valid**

Get valid actions for authenticated player. Requires authentication.

**Response (200):**
```json
{
  "canAct": true,
  "canFold": true,
  "canCheck": false,
  "canCall": true,
  "callAmount": 10,
  "canBet": false,
  "minBet": 10,
  "canRaise": true,
  "minRaise": 20,
  "maxRaise": 990,
  "canAllIn": true,
  "allInAmount": 990
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not authorized for this game
- `404` - Game not found

---

### Leave Game

**POST /games/:gameId/leave**

Leave the game. If game hasn't started, removes player. If game is active, marks as disconnected. Clears session cookie.

**Response (200):**
```json
{
  "message": "Left game successfully"
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Not authorized for this game
- `404` - Game not found

---

### Get Players

**GET /games/:gameId/players**

Get all players in game (public info only, no authentication required).

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Alice",
    "position": 0,
    "chips": 990,
    "currentBet": 10,
    "status": "active",
    "connected": true
  },
  {
    "id": "uuid",
    "name": "Bob",
    "position": 1,
    "chips": 980,
    "currentBet": 10,
    "status": "active",
    "connected": true
  }
]
```

---

## Game Flow Example

1. **Create game**: `POST /games`
2. **Players join**: `POST /games/:gameId/join` (each player)
3. **Start game**: `POST /games/:gameId/start`
4. **Game loop**:
   - `GET /games/:gameId/actions/valid` - Check what actions are available
   - `POST /games/:gameId/actions` - Submit action
   - `GET /games/:gameId` - Get updated state
5. **Reconnect** (if needed): `POST /games/:gameId/auth`

## Player Status Values

- `active` - Can act
- `folded` - Folded this hand
- `all_in` - All-in, no more chips
- `out` - Eliminated from game

## Round Values

- `preflop` - Before flop
- `flop` - After flop (3 community cards)
- `turn` - After turn (4th community card)
- `river` - After river (5th community card)
- `showdown` - Hand complete, winners determined
