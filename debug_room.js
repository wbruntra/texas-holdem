/**
 * Debug script to investigate room state using knex
 */

const db = require('./db');
const { getGameById } = require('./backend/services/game-service');

async function debugRoom(roomCode) {
  console.log(`\n🔍 Investigating room: ${roomCode}\n`);
  
  try {
    // Get game through service (which applies our fixes)
    const gameState = await getGameById((await db('games').where({ room_code: roomCode }).select('id').first())?.id);
    
    if (!gameState) {
      console.log('❌ Game not found');
      process.exit(0);
    }
    
    console.log('═══ GAME STATE (from service) ═══');
    console.log(`  ID: ${gameState.id}`);
    console.log(`  Room Code: ${gameState.roomCode}`);
    console.log(`  Status: ${gameState.status}`);
    console.log(`  Current Round: ${gameState.currentRound}`);
    console.log(`  Hand Number: ${gameState.handNumber}`);
    console.log(`  Dealer Position: ${gameState.dealerPosition}`);
    console.log(`  Current Player Position: ${gameState.currentPlayerPosition}`);
    console.log(`  Pot: $${gameState.pot}`);
    console.log(`  Current Bet: $${gameState.currentBet}`);
    
    console.log(`\n═══ PLAYERS (${gameState.players.length}) ═══`);
    gameState.players.forEach((p) => {
      console.log(`  P${p.position}: ${p.name}`);
      console.log(`    - Chips: $${p.chips}`);
      console.log(`    - Status: ${p.status}`);
      console.log(`    - Current Bet: $${p.currentBet}`);
      console.log(`    - Total Bet: $${p.totalBet}`);
      console.log(`    - Connected: ${p.connected ? '✓' : '✗'}`);
    });
    
    // Highlight current player
    const currentPlayerPos = gameState.currentPlayerPosition;
    if (currentPlayerPos !== null && currentPlayerPos !== undefined) {
      const currentPlayer = gameState.players.find(p => p.position === currentPlayerPos);
      if (currentPlayer) {
        console.log(`\n👉 CURRENT PLAYER: ${currentPlayer.name} (P${currentPlayerPos})`);
        console.log(`   Status: ${currentPlayer.status}`);
        console.log(`   Chips: $${currentPlayer.chips}`);
        console.log(`   Can Act: ${currentPlayer.status === 'active' && currentPlayer.chips > 0 ? 'Yes' : 'No'}`);
      }
    } else {
      console.log(`\n👉 CURRENT PLAYER: None (game is completed or not started)`);
    }
    
    // Check if anyone is all-in
    const allInPlayers = gameState.players.filter(p => p.status === 'all_in');
    if (allInPlayers.length > 0) {
      console.log(`\n⚠️  ALL-IN PLAYERS:`);
      allInPlayers.forEach(p => {
        console.log(`   ${p.name} (P${p.position}) - $${p.chips} chips, bet=$${p.currentBet}`);
      });
    }
    
    // Analyze the situation
    console.log(`\n═══ ANALYSIS ═══`);
    
    if (gameState.status === 'completed') {
      console.log(`✅ Game is completed`);
      console.log(`   This game should allow starting the next hand or ending the session`);
      if (gameState.currentPlayerPosition !== null && gameState.currentPlayerPosition !== undefined) {
        console.log(`   ⚠️  WARNING: Current player position should be null when game is completed`);
      } else {
        console.log(`   ✓ Current player position is properly cleared`);
      }
    } else if (gameState.status === 'active') {
      console.log(`🎮 Game is still active`);
      
      // Check if current player can act
      if (currentPlayerPos !== null && currentPlayerPos !== undefined) {
        const currentPlayer = gameState.players.find(p => p.position === currentPlayerPos);
        if (currentPlayer) {
          if (currentPlayer.status === 'all_in') {
            console.log(`⚠️  PROBLEM: Current player is ALL_IN but game says it's their turn!`);
            console.log(`   This should have been normalized.`);
          } else if (currentPlayer.status === 'folded') {
            console.log(`⚠️  PROBLEM: Current player has FOLDED but game says it's their turn!`);
            console.log(`   This should have been normalized.`);
          } else if (currentPlayer.chips === 0) {
            console.log(`⚠️  WARNING: Current player has $0 chips but status is ${currentPlayer.status}`);
          } else {
            console.log(`✓ Current player can act (${currentPlayer.name} is ${currentPlayer.status} with $${currentPlayer.chips})`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

const roomCode = process.argv[2] || 'P8757N';
debugRoom(roomCode);
