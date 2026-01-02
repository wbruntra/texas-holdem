# Texas Hold'em Terminal Client

A terminal-based client for playing Texas Hold'em poker, connecting to the same backend as the React web application.

## Requirements

- Bun runtime (https://bun.sh)
- Backend server running on port 3660

## Installation

```bash
cd terminal
bun install
```

## Running

```bash
bun start
# or
bun index.ts
```

## Features

- **Create Game**: Start a new poker game with configurable blinds and starting chips
- **Join Game**: Join an existing game with room code and password
- **View Table**: Watch a game as a spectator (table view mode)
- **Real-time Updates**: WebSocket connection for live game state
- **Full Game Actions**: Check, bet, call, raise, fold
- **Game Management**: Start game, advance rounds, next hand

## Commands

When in a game:

- `actions` or `a` - Show available actions
- `bet <amount>` - Place a bet
- `raise <amount>` - Raise the current bet
- `call` or `c` - Call the current bet
- `check` or `k` - Check (if allowed)
- `fold` or `f` - Fold your hand
- `next` or `n` - Start next hand (at showdown)
- `advance` - Advance to next betting round
- `refresh` or `r` - Refresh game state
- `quit` or `q` - Leave the game

## API Communication

The terminal client uses:

- HTTP API for game operations (join, actions, etc.)
- WebSocket for real-time game state updates
- Cookie-based session authentication (same as web client)
