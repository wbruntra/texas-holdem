# Event Logging for End-to-End Testing

## Overview

The event logging system captures all significant game events for end-to-end testing and debugging. Events are logged in real-time to both the console and a JSON file.

## Configuration

Event logging is controlled by the `LOG_EVENTS` environment variable in the `.env` file:

```env
LOG_EVENTS=true
```

Set to `false` or remove the variable to disable logging.

## Event Types

### Game Lifecycle

- `game:created` - New game created with room code
- `game:started` - Game starts, first hand dealt
- `game:reset` - Game reset to initial state
- `game:completed` - Game ended

### Player Events

- `player:joined` - Player joins game
- `player:left` - Player leaves or disconnects
- `player:authenticated` - Player logs in

### Hand Lifecycle

- `hand:started` - New hand begins
- `hand:completed` - Hand finishes with winners

### Betting Rounds

- `round:started` - New betting round (preflop, flop, turn, river)
- `round:completed` - Betting round finished

### Player Actions

- `action:check` - Player checks
- `action:bet` - Player bets
- `action:call` - Player calls
- `action:raise` - Player raises
- `action:fold` - Player folds
- `action:all_in` - Player goes all-in

### Game State Changes

- `state:blinds_posted` - Small/big blind posted
- `state:cards_dealt` - Hole cards dealt
- `state:community_cards_revealed` - Flop/turn/river revealed
- `state:showdown` - Hand reaches showdown
- `state:pots_distributed` - Pots awarded to winners
- `state:cards_shown` - Player reveals their cards

## API Endpoints

### Get All Events

```bash
GET /api/events/all
```

Returns all logged events with metadata.

### Get Events for Specific Game

```bash
GET /api/events/game/:gameId
```

Returns only events for the specified game.

### Clear Event Log

```bash
DELETE /api/events/all
```

Clears all logged events (useful for starting a fresh test).

### Export Events

```bash
POST /api/events/export
Body: { "filename": "my-test-events.json" }
```

Exports current events to a file in the project root.

## Event Structure

Each event has the following structure:

```json
{
  "timestamp": "2026-01-02T12:34:56.789Z",
  "eventType": "action:bet",
  "gameId": 123,
  "data": {
    "playerId": 456,
    "playerName": "Alice",
    "action": "bet",
    "amount": 50,
    "round": "flop"
  },
  "sequence": 42
}
```

## Output Files

- **Console**: All events are logged to console in real-time with format:

  ```
  [Event:42] action:bet [Game:123] {"playerId":456,"amount":50}
  ```

- **event-log.json**: All events are written to this file in the project root directory. The file is auto-flushed after each event.

## Usage Example

1. Start backend with logging enabled:

   ```bash
   cd backend
   LOG_EVENTS=true npm start
   ```

2. Run your game scenario (manually or with bots)

3. Retrieve the event log:

   ```bash
   curl http://localhost:3000/api/events/all | jq .
   ```

4. Or check the file:

   ```bash
   cat event-log.json | jq .
   ```

5. Use the log to write assertions in your tests

## Writing Tests with Event Logs

Example test structure:

```javascript
describe('Full Game Flow', () => {
  beforeEach(async () => {
    // Clear event log
    await fetch('http://localhost:3000/api/events/all', { method: 'DELETE' })
  })

  it('should handle 3-player all-in scenario', async () => {
    // 1. Run your game scenario
    const game = await createGame()
    await addPlayers(game, 3)
    await startGame(game)
    // ... more actions ...

    // 2. Retrieve event log
    const response = await fetch(`http://localhost:3000/api/events/game/${game.id}`)
    const { events } = await response.json()

    // 3. Verify expected sequence
    expect(events[0].eventType).toBe('game:created')
    expect(events[1].eventType).toBe('player:joined')
    expect(events[4].eventType).toBe('game:started')
    // ... more assertions ...

    // 4. Verify game logic correctness
    const showdownEvent = events.find((e) => e.eventType === 'state:showdown')
    expect(showdownEvent.data.pot).toBe(expectedPot)
  })
})
```

## Next Steps

Phase 2 will focus on:

1. Creating replay/scenario files from event logs
2. Building test fixtures from real game data
3. Automated test generation from event sequences
4. Comparing expected vs actual event streams
