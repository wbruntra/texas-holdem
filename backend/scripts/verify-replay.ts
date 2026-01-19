
import fs from 'fs';
import path from 'path';
// @ts-ignore
import db from '@holdem/database/db';
import { getGameById } from '../services/game-service';

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Please provide a path to the events JSON file.');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`Reading events from ${absolutePath}...`);
  const eventsRaw = fs.readFileSync(absolutePath, 'utf-8');
  const events = JSON.parse(eventsRaw);

  if (!Array.isArray(events) || events.length === 0) {
    console.error('Invalid or empty events array.');
    process.exit(1);
  }

  // Extract Game ID from events (assuming all are for the same game)
  const gameId = events[0].gameId;
  console.log(`Replaying Game ID: ${gameId}`);

  try {
    // 1. Clean DB
    // We need to clean tables to avoid conflicts.
    // Note: This wipes the DB for these tables!
    console.log('Cleaning database...');
    await db('game_events').del();
    await db('actions').del();
    await db('hands').del();
    await db('game_players').del();
    await db('room_players').del();
    await db('games').del();
    await db('rooms').del();

    // 2. Setup Seed Data (Room, Game, Players)
    // We need to ensure foreign keys are satisfied.
    // Events contain 'playerId'. We need to create corresponding room_players and game_players.

    // Create Room
    const roomId = 999;
    await db('rooms').insert({
      id: roomId,
      room_code: 'REPLAY',
      status: 'active',
      small_blind: 10,
      big_blind: 20,
      starting_chips: 1000,
      current_game_id: gameId,
    });

    // Create Game
    await db('games').insert({
      id: gameId,
      room_id: roomId,
      game_number: 1,
      room_code: 'REPLAY',
      status: 'active',
      small_blind: 10,
      big_blind: 20,
      starting_chips: 1000,
      dealer_position: 0,
      pot: 0,
      current_bet: 0,
    });

    // Identify Players from events
    // Look for PLAYER_JOINED events
    const playerJoinedEvents = events.filter((e: any) => e.eventType === 'PLAYER_JOINED');

    // Also collect all unique playerIds just in case
    const playerIds = new Set<number>();
    events.forEach((e: any) => {
        if (e.playerId) playerIds.add(e.playerId);
    });

    console.log(`Found ${playerIds.size} unique players.`);

    for (const pid of playerIds) {
        // Check if we have join info
        const joinEvent = playerJoinedEvents.find((e: any) => e.playerId === pid);
        let name = `Player ${pid}`;
        let position = 0;
        let chips = 1000;

        if (joinEvent && joinEvent.payload) {
            const payload = typeof joinEvent.payload === 'string' ? JSON.parse(joinEvent.payload) : joinEvent.payload;
            name = payload.name || name;
            position = payload.position !== undefined ? payload.position : 0;
            chips = payload.startingChips || 1000;
        }

        // Create Room Player (needed for name)
        // We use pid as ID to match event playerId
        // But Room Player ID is different from Game Player ID usually.
        // In the events, playerId usually refers to Game Player ID.
        // Let's assume Room Player ID = Game Player ID for simplicity, or we map it.
        // The table game_players maps game_id + room_player_id -> id.
        // The event log uses 'playerId' which corresponds to 'game_players.id'.

        // So we create a room_player with same ID (or arbitrary)
        // And a game_player with ID = pid.

        const roomPlayerId = pid + 10000; // Arbitrary offset

        await db('room_players').insert({
            id: roomPlayerId,
            room_id: roomId,
            name: name,
            connected: 1,
            session_token: `token_${pid}`,
            password_hash: 'hash'
        });

        await db('game_players').insert({
            id: pid,
            game_id: gameId,
            room_player_id: roomPlayerId,
            position: position,
            chips: chips, // Initial chips, though system should derive.
            // NOTE: The refactor stops reading chips from here, so this value shouldn't matter for the logic!
            // But we insert it to satisfy constraints or legacy checks if any.
            current_bet: 0,
            status: 'active'
        });
    }

    // 3. Insert Events
    console.log(`Inserting ${events.length} events...`);
    const eventRows = events.map((e: any) => ({
        game_id: e.gameId,
        hand_number: e.handNumber,
        sequence_number: e.sequenceNumber,
        event_type: e.eventType,
        player_id: e.playerId,
        payload: typeof e.payload === 'object' ? JSON.stringify(e.payload) : e.payload,
        created_at: e.timestamp ? new Date(e.timestamp) : new Date()
    }));

    await db('game_events').insert(eventRows);

    // 4. Verify with getGameById
    console.log('Deriving game state...');
    const gameState = await getGameById(gameId);

    if (!gameState) {
        throw new Error('getGameById returned null');
    }

    console.log('Game State Reconstructed Successfully!');
    console.log('-------------------------------------');
    console.log(`Round: ${gameState.currentRound}`);
    console.log(`Pot: ${gameState.pot}`);
    console.log(`Current Bet: ${gameState.currentBet}`);
    console.log(`Status: ${gameState.status}`);
    console.log(`Players: ${gameState.players.length}`);

    gameState.players.forEach((p: any) => {
        console.log(` - ${p.name} (ID: ${p.id}): ${p.chips} chips, ${p.status}, Bet: ${p.currentBet}`);
    });

    // Simple assertions based on typical game flow logic validity
    if (gameState.pot < 0) throw new Error('Pot is negative');
    if (gameState.players.some((p: any) => p.chips < 0)) throw new Error('Player has negative chips');

    // If we want to check specific values for h6r4ud-game-1-events.json:
    // Last event was ALL_IN by Player 7 (460).
    // Let's assume we know what to expect.
    // Based on logs:
    // Hand 2.
    // Pot should reflect bets.

    console.log('-------------------------------------');
    console.log('Verification Complete: PASS');

  } catch (err) {
    console.error('Verification Failed:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

run();
