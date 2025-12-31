/**
 * Aggressive Simulation - Bot 1 always bets 50, Bot 2 always calls
 * Runs until one player goes broke
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
  shouldContinueToNextRound,
} = require('./backend/lib/game-state-machine');
const {
  processAction,
  getValidActions,
  validateAction,
} = require('./backend/lib/betting-logic');
const { calculatePots } = require('./backend/lib/pot-manager');
const { evaluateHand } = require('./backend/lib/poker-engine');

const STARTING_CHIPS = 1000;
const AGGRESSIVE_BET = 50;
let state = null;
let handCount = 0;

function validateChipTotal(label) {
  const total = state.players.reduce((sum, p) => sum + p.chips, 0) + state.pot;
  const expected = STARTING_CHIPS * state.players.length;

  if (total !== expected) {
    console.log(`\n❌ CHIP ERROR at ${label}!`);
    console.log(
      `   Expected: ${expected}, Got: ${total}, Difference: ${total - expected}`
    );
    console.log(
      `   P0: ${state.players[0].chips}, P1: ${state.players[1].chips}, Pot: ${state.pot}`
    );
    return false;
  }
  return true;
}

function bot1DecideAction(playerPosition) {
  const actions = getValidActions(state, playerPosition);

  if (!actions.canAct) return null;

  // Bot 1 strategy: Always bet/raise 50 if possible, otherwise call
  if (actions.canBet && state.players[playerPosition].chips >= AGGRESSIVE_BET) {
    return { action: ACTION_TYPE.BET, amount: AGGRESSIVE_BET };
  } else if (
    actions.canRaise &&
    state.players[playerPosition].chips >= actions.callAmount + AGGRESSIVE_BET
  ) {
    return { action: ACTION_TYPE.RAISE, amount: AGGRESSIVE_BET };
  } else if (actions.canCall) {
    return { action: ACTION_TYPE.CALL };
  } else if (actions.canCheck) {
    return { action: ACTION_TYPE.CHECK };
  } else {
    return { action: ACTION_TYPE.FOLD };
  }
}

function bot2DecideAction(playerPosition) {
  const actions = getValidActions(state, playerPosition);

  if (!actions.canAct) return null;

  // Bot 2 strategy: Always call if possible, otherwise check
  if (actions.canCall) {
    return { action: ACTION_TYPE.CALL };
  } else if (actions.canCheck) {
    return { action: ACTION_TYPE.CHECK };
  } else {
    return { action: ACTION_TYPE.FOLD };
  }
}

function playBettingRound() {
  let iterations = 0;
  const maxIterations = 20;

  while (!isBettingRoundComplete(state) && iterations < maxIterations) {
    iterations++;

    const playerPos = state.currentPlayerPosition;
    if (playerPos === null) break;

    const player = state.players[playerPos];
    const beforeChips = player.chips;
    const beforePot = state.pot;

    const decision =
      playerPos === 0
        ? bot1DecideAction(playerPos)
        : bot2DecideAction(playerPos);
    if (!decision) break;

    const validation = validateAction(
      state,
      playerPos,
      decision.action,
      decision.amount || 0
    );
    if (!validation.valid) {
      console.log(
        `   ⚠️  P${playerPos} ${decision.action} invalid: ${validation.error}`
      );
      break;
    }

    state = processAction(
      state,
      playerPos,
      decision.action,
      decision.amount || 0
    );

    const afterChips = state.players[playerPos].chips;
    const afterPot = state.pot;
    const chipsSpent = beforeChips - afterChips;
    const potIncrease = afterPot - beforePot;

    if (chipsSpent !== potIncrease) {
      console.log(
        `   💥 MISMATCH: P${playerPos} ${decision.action} spent $${chipsSpent} but pot only increased $${potIncrease}`
      );
    }

    if (!validateChipTotal(`after ${decision.action}`)) {
      console.log(`   💥 CHIP ERROR after P${playerPos} ${decision.action}`);
      process.exit(1);
    }
  }

  if (iterations >= maxIterations) {
    console.log(`   ⚠️  Max iterations reached!`);
  }
}

function playHand() {
  handCount++;

  state = startNewHand(state);

  // Check if game ended after startNewHand (e.g., only one player with chips)
  if (state.status === 'completed') {
    console.log(
      `\n🎯 Game completed at start of hand ${handCount} - only one player has chips`
    );
    return false;
  }

  const initialTotal =
    state.players[0].chips + state.players[1].chips + state.pot;
  console.log(
    `Hand ${handCount}: P0=$${state.players[0].chips} P1=$${state.players[1].chips} Pot=$${state.pot} (total=$${initialTotal})`
  );
  console.log(
    `  (Before blinds: P0 had $${state.players[0].chips + state.players[0].totalBet}, P1 had $${state.players[1].chips + state.players[1].totalBet})`
  );

  if (!validateChipTotal('after startNewHand')) {
    process.exit(1);
  }

  // Play preflop
  playBettingRound();

  // Check if hand should end (everyone folded except one)
  const afterPreflopActive = state.players.filter(
    (p) =>
      p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN
  );

  if (afterPreflopActive.length < 2) {
    // One player remains, needs showdown to award pot
    state = advanceRound(state);
    state = processShowdown(state);

    if (state.status === 'completed') {
      return false;
    }
    return true;
  }

  // Play through streets
  const streets = [ROUND.FLOP, ROUND.TURN, ROUND.RIVER];
  for (const street of streets) {
    if (!shouldContinueToNextRound(state)) break;

    state = advanceRound(state);

    if (!validateChipTotal(`after advancing to ${state.currentRound}`)) {
      process.exit(1);
    }

    playBettingRound();

    const stillActive = state.players.filter(
      (p) =>
        p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN
    );

    if (stillActive.length < 2) {
      // One player remains, advance to showdown
      state = advanceRound(state);
      break;
    }
  }

  // Showdown
  if (state.currentRound === ROUND.RIVER && isBettingRoundComplete(state)) {
    console.log(
      `  Showdown: P0=$${state.players[0].chips} (bet=${state.players[0].totalBet}) P1=$${state.players[1].chips} (bet=${state.players[1].totalBet}) Pot=${state.pot}`
    );

    state = advanceRound(state);

    if (!validateChipTotal('before processShowdown')) {
      process.exit(1);
    }

    const pots = calculatePots(state.players);
    console.log(
      `  Pots calculated:`,
      pots.map((p) => `$${p.amount}`).join(', ')
    );

    state = processShowdown(state);

    // Check if game is over
    if (state.status === 'completed') {
      console.log(`  → Game completed after showdown`);
      return false; // Signal game over
    }

    // Show winner
    const eval0 =
      state.players[0].holeCards.length === 2
        ? evaluateHand(state.players[0].holeCards, state.communityCards)
        : null;
    const eval1 =
      state.players[1].holeCards.length === 2
        ? evaluateHand(state.players[1].holeCards, state.communityCards)
        : null;

    console.log(
      `  → Winner: P${state.winners[0]} (${eval0 ? eval0.rankName : '?'} vs ${eval1 ? eval1.rankName : '?'})`
    );

    if (!validateChipTotal('after processShowdown')) {
      console.log(`\n💥 CHIP ERROR at showdown!`);
      console.log(`Pots:`, state.pots);
      console.log(
        `Players:`,
        state.players.map((p) => ({
          chips: p.chips,
          totalBet: p.totalBet,
          status: p.status,
        }))
      );
      process.exit(1);
    }
  } else if (state.currentRound !== ROUND.SHOWDOWN) {
    // Hand didn't reach showdown naturally, advance and process
    console.log(
      `  Early end: P0=$${state.players[0].chips} (bet=${state.players[0].totalBet}) P1=$${state.players[1].chips} (bet=${state.players[1].totalBet}) Pot=${state.pot} Round=${state.currentRound}`
    );

    state = advanceRound(state);
    state = processShowdown(state);

    if (state.status === 'completed') {
      console.log(`  → Game completed after early showdown`);
      return false;
    }
  }

  return true; // Hand completed successfully
}

// Initialize
console.log('🎮 Aggressive Betting Simulation');
console.log('Strategy: P0 always bets $50, P1 always calls');
console.log(`Starting: $${STARTING_CHIPS} each\n`);

const players = [
  { id: '1', name: 'Aggressive Bot' },
  { id: '2', name: 'Calling Bot' },
];

state = createGameState({ players, startingChips: STARTING_CHIPS });

if (!validateChipTotal('initial state')) {
  process.exit(1);
}

// Play until game is completed
try {
  while (state.status !== 'completed') {
    const handCompleted = playHand();

    if (!handCompleted || state.status === 'completed') {
      break; // Game over
    }

    // Progress update every 10 hands
    if (handCount % 10 === 0) {
      console.log(
        `[${handCount} hands] P0=$${state.players[0].chips} P1=$${state.players[1].chips}`
      );
    }

    // Safety limit
    if (handCount >= 200) {
      console.log(`\n⏸️  Reached 200 hands, stopping.`);
      break;
    }
  }

  console.log(`\n🎯 GAME OVER!`);
  console.log(
    `Final state - P0: $${state.players[0].chips}, P1: $${state.players[1].chips}, Pot: $${state.pot}`
  );
  console.log(`\n✅ SIMULATION COMPLETE`);
  console.log(`Hands played: ${handCount}`);
  console.log(
    `Final: P0=$${state.players[0].chips} P1=$${state.players[1].chips}`
  );
  console.log(
    `Total: $${state.players[0].chips + state.players[1].chips + state.pot} (should be $${STARTING_CHIPS * 2})`
  );
} catch (error) {
  console.log(`\n❌ ERROR:`, error.message);
  console.log(error.stack);
  process.exit(1);
}
