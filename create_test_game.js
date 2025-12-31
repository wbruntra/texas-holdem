#!/usr/bin/env bun
/**
 * Create a test game for bots to play
 * Usage: bun create_test_game.js
 */

const axios = require('axios');

async function main() {
  try {
    const api = axios.create({
      baseURL: 'http://localhost:3660/api',
      validateStatus: () => true,
    });

    // Create game
    const gameRes = await api.post('/games', {
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
    });

    if (gameRes.status !== 201) {
      throw new Error(`Failed to create game: ${gameRes.data?.error}`);
    }

    const game = gameRes.data;
    console.log(`\n✅ Game created!`);
    console.log(`   Room Code: ${game.roomCode}`);
    console.log(`   Game ID: ${game.id}`);
    console.log(`\n📝 To run bots, use:`);
    console.log(`   bun bots_play.js ${game.roomCode}`);
    console.log(`\n🌐 To observe, visit:`);
    console.log(`   http://localhost:5173/table/${game.roomCode}`);
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
