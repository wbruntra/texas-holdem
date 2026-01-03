# AGENTS.md - Texas Hold'em Poker Game

This document provides guidance for AI agents working on this codebase.

## Quick Start Commands

### Run the Application

```bash
# Start both backend and frontend
bun start

# Start individually
bun run backend  # Terminal: cd backend && bun run api
bun run frontend # Terminal: cd frontend && bun run dev
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test ./backend/test/services.test.js

# Run a single test (grep pattern)
bun test -- --grep "rejoin"
```

### Formatting

```bash
# Format all files
bun run format

# Check formatting (will exit non-zero if unformatted)
bun run format:check
```

---

## Project Structure

```
/home/william/src/tries/2025-12-30-holdem/
├── backend/          # Express.js API + WebSocket server (CommonJS)
├── frontend/         # React frontend with Vite (ESM)
├── terminal/         # Terminal client with Inquirer.js (ESM)
├── shared/           # Shared TypeScript types
├── tables/           # Database schema (auto-generated from DDL)
└── migrations/       # Knex database migrations
```

---

## Code Style Guidelines

### General Principles

- **Use Bun** - Not Node.js, not npm. See CLAUDE.md for Bun-specific patterns
- **Minimal comments** - Only add comments when absolutely necessary for clarity
- **Avoid comments entirely** for simple/obvious code
- **Single quotes** for all strings
- **No semicolons** at line ends
- **2 space indentation** (not tabs)

### JavaScript/TypeScript Patterns

#### Backend (CommonJS)

```javascript
// Use require for imports
const bcrypt = require('bcryptjs')
const db = require('../../db')

// JSDoc for exported functions only
/**
 * Add a player to a game
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Created player
 */
async function joinGame(gameId, playerName, password) {
  // ...
}
```

#### Frontend/Terminal (ESM)

```typescript
// Use ES imports
import type { GameState, Player } from './types'
import { formatCard } from './cardUtils'

// Props interface for components
type Props = {
  game: GameState
  player: Player
  index: number
}

export default function PlayerSeat({ game, player, index }: Props) {
  // Component logic
}
```

### Naming Conventions

| Type                | Convention           | Example                              |
| ------------------- | -------------------- | ------------------------------------ |
| Variables/functions | camelCase            | `currentBet`, `isMyTurn`             |
| Constants           | SCREAMING_SNAKE_CASE | `BACKEND_PORT`, `STARTING_CHIPS`     |
| Classes/PascalCase  | PascalCase           | `PokerTerminal`, `GameLoop`          |
| Files               | kebab-case           | `player-service.js`, `card-utils.ts` |
| Database columns    | snake_case           | `game_id`, `current_bet`             |
| JSDoc params        | camelCase            | `@param {string} gameId`             |

### Error Handling

```javascript
// Backend: Throw Error with message, let route handler send response
async function someAction(gameId) {
  if (!gameId) {
    throw new Error('Game ID required')
  }
  // ...
}

// Frontend: Try/catch with display error
try {
  await this.api.performAction(gameId, action, amount)
} catch (err) {
  this.display.printError(`Action failed: ${err.message}`)
}
```

### React Components

```typescript
// Use TypeScript interfaces for props
type Props = {
  game: GameState
  player: Player
  index: number
  style: CSSProperties
}

// Use default exports for components
export default function PlayerSeat({ game, player, index, style }: Props) {
  // Derive state from props, avoid useState duplication
  const isFolded = player.status === 'folded'
  const isAllIn = player.status === 'all_in'

  return (
    <div className={`seat ${isActive ? 'active' : 'inactive'}`}>
      {/* JSX */}
    </div>
  )
}
```

### Database Queries

```javascript
// Use knex query builder
const game = await db('games').where({ id: gameId }).first()

// Complex queries
const players = await db('players').where({ game_id: gameId }).orderBy('position').limit(10)
```

### Async/Await

```javascript
// Always handle async errors with try/catch
async function getGameState(gameId) {
  try {
    const state = await this.api.getGameState(gameId)
    this.display.printGameState(state, this.playerName)
  } catch (err) {
    this.display.printError(`Failed to refresh state: ${err.message}`)
  }
}

// For validation, throw early
async function validatePlayer(name, password) {
  if (!name || name.trim().length === 0) {
    throw new Error('Player name is required')
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters')
  }
}
```

---

## Testing Guidelines

- **Test files**: `.test.js` or `test/*.js` in backend
- **Use bun test** - Not Jest or Vitest
- **Database tests**: May need `NODE_ENV=test knex migrate:latest` first
- **Unit tests** in `backend/test/` test services in isolation
- **Integration tests** simulate full game flows

```javascript
test('allows rejoining with same password', async () => {
  const game = await gameService.createGame()
  const player1 = await playerService.joinGame(game.id, 'Alice', 'pass1')

  const player2 = await playerService.joinGame(game.id, 'Alice', 'pass1')
  expect(player2.id).toBe(player1.id)
})
```

---

## Configuration

- **Prettier** for formatting (see `.prettierignore` and `prettier.config.js`)
- **Husky** + **lint-staged** for pre-commit formatting
- **TypeScript** strict mode enabled in frontend
- **No lint script** in backend (uses Prettier only)

---

## Terminal Client Specifics

The terminal client uses **Inquirer.js** for prompts:

```typescript
// List selection (arrow keys)
const { choice } = await inquirer.prompt({
  type: 'list',
  name: 'choice',
  message: 'Select option:',
  choices: [
    { name: 'Create new game', value: 'create' },
    { name: 'Join existing game', value: 'join' },
  ],
})

// Plain input with validation
const { amount } = await inquirer.prompt({
  type: 'input',
  name: 'amount',
  message: 'Enter amount:',
  validate: (input) => {
    const val = parseInt(input)
    return !isNaN(val) && val > 0 ? true : 'Invalid amount'
  },
})
```

---

## Database Schema

Schema files are auto-generated in `tables/` folder from DDL. Run `read_db.js` to regenerate:

```bash
node read_db.js
```

Always check `tables/` for current schema rather than migration files.

---

## WebSocket Events

The app uses WebSockets for real-time game updates. See `websocket-service.js` for event handling patterns.

---

## Key Files to Know

| File                                 | Purpose              |
| ------------------------------------ | -------------------- |
| `backend/services/game-service.js`   | Core game logic      |
| `backend/services/player-service.js` | Player management    |
| `backend/services/action-service.js` | Betting actions      |
| `frontend/src/components/table/`     | Table UI components  |
| `terminal/index.ts`                  | Terminal entry point |
| `terminal/game-loop.ts`              | Terminal game flow   |
