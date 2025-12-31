# Texas Hold'em Poker Game

A real-time multiplayer Texas Hold'em poker game built with modern web technologies. Players can join games using a room code, with a shared table view for spectators and individual player views for participants.

## Features

- **Real-time gameplay** with WebSocket connections
- **Multiplayer support** with room codes for easy joining
- **Dual UI modes**: Table view (shared screen) and Player view (mobile-optimized)
- **Complete poker logic** including betting rounds, hand evaluation, and pot management
- **Bot players** for testing and simulation
- **Database persistence** with SQLite
- **Responsive design** for desktop and mobile

## Tech Stack

- **Backend**: Node.js, Express, WebSockets
- **Frontend**: React, TypeScript, Vite
- **Database**: SQLite with Knex.js migrations
- **Runtime**: Bun
- **Styling**: Bootstrap

## Prerequisites

- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- Node.js 18+ (if not using Bun)

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd 2025-12-30-holdem
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

## Database Setup

1. Run database migrations:

   ```bash
   bunx knex migrate:latest
   ```

2. (Optional) Seed the database or run tests to create test data:
   ```bash
   bunx knex migrate:latest --env test
   ```

The application uses SQLite databases:

- `holdem.sqlite3` for development
- `holdem-test.sqlite3` for testing

## Running the Application

### Development Mode

Start both backend and frontend simultaneously:

```bash
bun run start
```

This runs:

- Backend API server (default port 3660)
- Frontend development server (default port 5173)

### Individual Services

Start backend only:

```bash
bun run backend
```

Start frontend only:

```bash
bun run frontend
```

### Production

For production deployment, use the backend's PM2 configuration:

```bash
cd backend
bunx pm2 start ecosystem.config.js
```

## Testing

Run backend tests:

```bash
cd backend
bun run test
```

Run database migrations for test environment:

```bash
bunx knex migrate:latest --env test
```

## Scripts and Tools

The repository includes several utility scripts:

- `simulate_game.js` - Simulate a full poker game
- `bots_play.js` - Run bot players
- `analyze_hand.js` - Analyze poker hands
- `create_test_game.js` - Create test game data

Example:

```bash
bun run simulate_game.js
```

## API Documentation

See [API.md](API.md) for detailed API endpoints and WebSocket events.

## Project Structure

```
├── backend/          # Express server, WebSocket service, game logic
├── frontend/         # React application (table and player views)
├── shared/           # Shared TypeScript types and constants
├── tables/           # Database table definitions
├── migrations/       # Knex database migrations
├── planning/         # Project planning and documentation
└── debug/            # Debugging scripts and tools
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure everything works
5. Submit a pull request

## License

This project is private and not licensed for public use.
