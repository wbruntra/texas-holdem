/**
 * Detailed hand investigation script
 */

const db = require('./db');
const { getGameById } = require('./backend/services/game-service');

async function investigateHand(roomCode) {
  console.log(`\n🔍 Investigating hand in room: ${roomCode}\n`);
  
  try {
    // Get game through service
    const gameRow = await db('games').where({ room_code: roomCode }).first();
    if (!gameRow) {
      console.log('❌ Game not found');
      process.exit(0);
    }
    
    const gameState = await getGameById(gameRow.id);
    
    console.log('═══ HAND STATE ═══');
    console.log(`  Hand Number: ${gameState.handNumber}`);
    console.log(`  Status: ${gameState.status}`);
    console.log(`  Current Round: ${gameState.currentRound}`);
    console.log(`  Pot: $${gameState.pot}`);
    console.log(`  Current Bet: $${gameState.currentBet}`);
    
    console.log(`\n═══ COMMUNITY CARDS ═══`);
    if (gameState.communityCards && gameState.communityCards.length > 0) {
      console.log(`  ${gameState.communityCards.join(' ')}`);
    } else {
      console.log(`  No community cards (hand hasn't reached flop or cards were cleared)`);
    }
    
    console.log(`\n═══ PLAYER HOLE CARDS ═══`);
    gameState.players.forEach((p, i) => {
      const cards = p.holeCards && p.holeCards.length === 2 ? p.holeCards.join(' ') : '(not dealt or hidden)';
      console.log(`  P${i} (${p.name}): ${cards}`);
    });
    
    console.log(`\n═══ WINNERS ═══`);
    if (gameState.winners && gameState.winners.length > 0) {
      console.log(`  Winners: P${gameState.winners.join(', P')}`);
    } else {
      console.log(`  No winners recorded`);
    }
    
    console.log(`\n═══ POTS ═══`);
    if (gameState.pots && gameState.pots.length > 0) {
      gameState.pots.forEach((pot, i) => {
        console.log(`  Pot ${i + 1}: $${pot.amount}`);
        if (pot.contributors && pot.contributors.length > 0) {
          console.log(`    Contributors: P${pot.contributors.join(', P')}`);
        }
        if (pot.winners && pot.winners.length > 0) {
          console.log(`    Winners: P${pot.winners.join(', P')}`);
        }
      });
    } else {
      console.log(`  No pots recorded`);
    }
    
    console.log(`\n═══ PLAYER FINAL STATE ═══`);
    gameState.players.forEach((p, i) => {
      console.log(`  P${i} (${p.name})`);
      console.log(`    - Chips: $${p.chips}`);
      console.log(`    - Status: ${p.status}`);
      console.log(`    - Current Bet: $${p.currentBet}`);
      console.log(`    - Total Bet: $${p.totalBet}`);
    });
    
    // Check hand history
    console.log(`\n═══ HAND HISTORY ═══`);
    const hands = await db('hands')
      .where({ game_id: gameRow.id })
      .orderBy('hand_number', 'desc')
      .limit(1);
    
    if (hands.length > 0) {
      const hand = hands[0];
      console.log(`  Hand ${hand.hand_number}:`);
      console.log(`    - Winner(s): ${hand.winners}`);
      console.log(`    - Result: ${hand.result}`);
      console.log(`    - Pot Awarded: $${hand.pot_awarded}`);
      console.log(`    - Created: ${hand.created_at}`);
    } else {
      console.log(`  No hand history recorded yet`);
    }
    
    // ANALYSIS
    console.log(`\n═══ ANALYSIS ═══`);
    
    if (gameState.status === 'completed') {
      console.log(`✅ Game is completed`);
      
      if (gameState.currentRound === 'flop') {
        console.log(`⚠️  SUSPICIOUS: Game completed at FLOP round (should be at SHOWDOWN)`);
        console.log(`   This suggests the hand ended before reaching showdown`);
      }
      
      if (!gameState.winners || gameState.winners.length === 0) {
        console.log(`⚠️  WARNING: No winners recorded`);
      } else {
        console.log(`✓ Winners recorded: P${gameState.winners.join(', P')}`);
      }
      
      // Check if someone went all-in
      const allInPlayers = gameState.players.filter(p => p.status === 'all_in');
      if (allInPlayers.length > 0) {
        console.log(`\n📌 All-in player(s) detected:`);
        allInPlayers.forEach(p => {
          console.log(`   ${p.name} (P${p.position}) - totalBet=$${p.totalBet}`);
        });
        
        if (gameState.currentRound !== 'showdown') {
          console.log(`⚠️  Game ended with all-in but never reached showdown`);
          console.log(`   Should have auto-advanced through remaining streets and evaluated at river`);
        }
      }
      
      // Check community cards
      if (!gameState.communityCards || gameState.communityCards.length === 0) {
        console.log(`\n⚠️  No community cards - hand may have ended early`);
      } else if (gameState.communityCards.length < 5) {
        console.log(`\n⚠️  Incomplete community cards (${gameState.communityCards.length}/5)`);
      } else {
        console.log(`\n✓ Full community cards available (river reached)`);
      }
      
    } else {
      console.log(`🎮 Game is still active (not completed)`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

const roomCode = process.argv[2] || 'P8757N';
investigateHand(roomCode);
