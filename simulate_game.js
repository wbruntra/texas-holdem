/**
 * Full Game Simulation - Two Bots Playing Texas Hold'em
 * This simulates complete hands with betting to find chip duplication bugs
 */

const {
  createGameState,
  startNewHand,
  processShowdown,
  advanceRound,
  PLAYER_STATUS,
  ROUND,
  ACTION_TYPE,
  isBettingRoundComplete,
  shouldContinueToNextRound
} = require('./backend/lib/game-state-machine');
const { processAction, getValidActions, validateAction } = require('./backend/lib/betting-logic');
const { calculatePots, distributePots, awardPots } = require('./backend/lib/pot-manager');
const { evaluateHand } = require('./backend/lib/poker-engine');

const STARTING_CHIPS = 1000;
let state = null;
let handCount = 0;

function validateChipTotal(label) {
  const total = state.players.reduce((sum, p) => sum + p.chips, 0) + state.pot;
  const expected = STARTING_CHIPS * state.players.length;
  
  if (total !== expected) {
    console.log(`\n❌ CHIP DUPLICATION DETECTED at ${label}!`);
    console.log(`   Expected: ${expected}, Got: ${total}, Difference: ${total - expected}`);
    console.log(`   Player 0: ${state.players[0].chips}, Player 1: ${state.players[1].chips}, Pot: ${state.pot}`);
    return false;
  }
  return true;
}

function botDecideAction(playerPosition) {
  const actions = getValidActions(state, playerPosition);
  
  if (!actions.canAct) {
    console.log(`   Player ${playerPosition} cannot act`);
    return null;
  }
  
  // Simple bot strategy: 70% call/check, 20% fold, 10% raise
  const rand = Math.random();
  
  if (actions.canCheck) {
    return { action: ACTION_TYPE.CHECK };
  } else if (actions.canCall && rand < 0.7) {
    return { action: ACTION_TYPE.CALL };
  } else if (actions.canRaise && rand < 0.8 && state.players[playerPosition].chips > actions.callAmount + actions.minRaise) {
    const raiseAmount = actions.minRaise;
    return { action: ACTION_TYPE.RAISE, amount: raiseAmount };
  } else if (actions.canCall) {
    return { action: ACTION_TYPE.CALL };
  } else {
    return { action: ACTION_TYPE.FOLD };
  }
}

function playBettingRound() {
  let iterations = 0;
  const maxIterations = 20;
  
  console.log(`   Round: ${state.currentRound}, Current bet: ${state.currentBet}`);
  
  while (!isBettingRoundComplete(state) && iterations < maxIterations) {
    iterations++;
    
    const playerPos = state.currentPlayerPosition;
    if (playerPos === null) break;
    
    const player = state.players[playerPos];
    console.log(`   Player ${playerPos} (${player.chips} chips) acting...`);
    
    const decision = botDecideAction(playerPos);
    if (!decision) break;
    
    console.log(`   → ${decision.action}${decision.amount ? ` $${decision.amount}` : ''}`);
    
    const validation = validateAction(state, playerPos, decision.action, decision.amount || 0);
    if (!validation.valid) {
      console.log(`   ⚠️  Invalid action: ${validation.error}`);
      break;
    }
    
    state = processAction(state, playerPos, decision.action, decision.amount || 0);
    
    if (!validateChipTotal(`after ${decision.action}`)) {
      console.log(`   State dump:`, JSON.stringify({
        pot: state.pot,
        players: state.players.map(p => ({ chips: p.chips, currentBet: p.currentBet, totalBet: p.totalBet }))
      }, null, 2));
      process.exit(1);
    }
  }
  
  if (iterations >= maxIterations) {
    console.log(`   ⚠️  Max iterations reached in betting round!`);
  }
}

function playHand() {
  handCount++;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HAND ${handCount}`);
  console.log(`${'='.repeat(60)}`);
  
  state = startNewHand(state);
  
  console.log(`Starting chips: P0=${state.players[0].chips}, P1=${state.players[1].chips}, Pot=${state.pot}`);
  
  if (!validateChipTotal('after startNewHand')) {
    process.exit(1);
  }
  
  // Play preflop
  console.log(`\n📍 PREFLOP`);
  playBettingRound();
  
  // Check if hand ended (someone folded)
  const activePlayers = state.players.filter(p => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN);
  if (activePlayers.length < 2) {
    console.log(`\n🏁 Hand ended (only ${activePlayers.length} player remaining)`);
    if (!validateChipTotal('after early end')) {
      process.exit(1);
    }
    return;
  }
  
  // Advance through streets
  const streets = [ROUND.FLOP, ROUND.TURN, ROUND.RIVER];
  for (const street of streets) {
    if (!shouldContinueToNextRound(state)) break;
    
    state = advanceRound(state);
    console.log(`\n📍 ${state.currentRound.toUpperCase()}`);
    console.log(`   Community: ${state.communityCards.map(c => `${c.rank}${c.suit[0]}`).join(' ')}`);
    
    if (!validateChipTotal(`after advancing to ${state.currentRound}`)) {
      process.exit(1);
    }
    
    playBettingRound();
    
    const stillActive = state.players.filter(p => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN);
    if (stillActive.length < 2) {
      console.log(`\n🏁 Hand ended (only ${stillActive.length} player remaining)`);
      return;
    }
  }
  
  // Showdown
  console.log(`\n   At end of hand, current round: ${state.currentRound}`);
  console.log(`   Active players: ${state.players.filter(p => p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN).length}`);
  
  if (state.currentRound === ROUND.RIVER && isBettingRoundComplete(state)) {
    // River complete, go to showdown
    state = advanceRound(state);
    console.log(`\n📍 SHOWDOWN`);
    console.log(`   P0 hole cards: ${state.players[0].holeCards.map(c => `${c.rank}${c.suit[0]}`).join(' ')}`);
    console.log(`   P1 hole cards: ${state.players[1].holeCards.map(c => `${c.rank}${c.suit[0]}`).join(' ')}`);
    console.log(`   Community: ${state.communityCards.map(c => `${c.rank}${c.suit[0]}`).join(' ')}`);
    
    // Evaluate hands
    if (state.players[0].holeCards.length === 2) {
      const eval0 = evaluateHand(state.players[0].holeCards, state.communityCards);
      console.log(`   P0: ${eval0.rankName}`);
    }
    if (state.players[1].holeCards.length === 2) {
      const eval1 = evaluateHand(state.players[1].holeCards, state.communityCards);
      console.log(`   P1: ${eval1.rankName}`);
    }
    
    console.log(`\n   Before showdown: P0=${state.players[0].chips} (totalBet=${state.players[0].totalBet}), P1=${state.players[1].chips} (totalBet=${state.players[1].totalBet}), Pot=${state.pot}`);
    
    if (!validateChipTotal('before processShowdown')) {
      process.exit(1);
    }
    
    // Calculate pots manually to debug
    console.log(`   state.pots before processShowdown:`, state.pots);
    const pots = calculatePots(state.players);
    console.log(`   Calculated pots:`, pots);
    console.log(`   Player totalBets: P0=${state.players[0].totalBet}, P1=${state.players[1].totalBet}`);
    
    state = processShowdown(state);
    
    console.log(`   After showdown: P0=${state.players[0].chips}, P1=${state.players[1].chips}, Pot=${state.pot}`);
    console.log(`   Winners: ${state.winners}`);
    
    if (!validateChipTotal('after processShowdown')) {
      console.log('\n📊 DETAILED STATE:');
      console.log(`   Pots:`, state.pots);
      console.log(`   Player states:`, state.players.map(p => ({
        chips: p.chips,
        totalBet: p.totalBet,
        currentBet: p.currentBet,
        status: p.status
      })));
      process.exit(1);
    }
  }
}

// Initialize game
console.log('🎮 Starting Texas Hold\'em Simulation');
console.log(`Starting chips: ${STARTING_CHIPS} per player\n`);

const players = [
  { id: '1', name: 'Bot A' },
  { id: '2', name: 'Bot B' }
];

state = createGameState({ players, startingChips: STARTING_CHIPS });

if (!validateChipTotal('initial state')) {
  process.exit(1);
}

// Play 5 hands
try {
  for (let i = 0; i < 5; i++) {
    playHand();
    
    // Check if someone busted
    if (state.players.some(p => p.chips === 0)) {
      console.log(`\n🎯 Game over - someone busted!`);
      break;
    }
  }
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`✅ SIMULATION COMPLETED SUCCESSFULLY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Final chips: P0=${state.players[0].chips}, P1=${state.players[1].chips}`);
  console.log(`Total: ${state.players[0].chips + state.players[1].chips} (should be ${STARTING_CHIPS * 2})`);
  
} catch (error) {
  console.log(`\n\n❌ ERROR:`, error.message);
  console.log(error.stack);
  process.exit(1);
}
