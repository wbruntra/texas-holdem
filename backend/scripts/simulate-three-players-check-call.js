#!/usr/bin/env bun

/**
 * Simple Texas Hold'em simulation (no DB)
 *
 * - Creates a 3-player game
 * - Players always: CHECK if possible, else CALL
 * - Runs a single hand to showdown
 * - Prints actions, board runout, and winner(s)
 *
 * Run:
 *   bun run backend/scripts/simulate-three-players-check-call.js
 */

const {
  createGameState,
  startNewHand,
  advanceRound,
  processShowdown,
  isBettingRoundComplete,
  shouldContinueToNextRound,
  ROUND,
} = require('../lib/game-state-machine');

const { processAction, getValidActions } = require('../lib/betting-logic');
const { evaluateHand } = require('../lib/poker-engine');

function cardsToString(cards) {
  if (!cards || cards.length === 0) return '(none)';
  return cards
    .map((c) =>
      typeof c?.toString === 'function'
        ? c.toString()
        : `${c.rank} of ${c.suit}`
    )
    .join(' ');
}

function printStacks(state) {
  const parts = state.players.map((p) => {
    const flags = [
      p.isDealer ? 'D' : null,
      p.isSmallBlind ? 'SB' : null,
      p.isBigBlind ? 'BB' : null,
    ]
      .filter(Boolean)
      .join(',');
    const status = p.status;
    const tag = flags ? ` (${flags})` : '';
    return `${p.position}:${p.name}${tag} chips=${p.chips} bet=${p.currentBet} status=${status}`;
  });
  console.log(parts.join('\n'));
}

function printStateHeader(state, label) {
  console.log(`\n=== ${label} ===`);
  console.log(
    `round=${state.currentRound} pot=${state.pot} currentBet=${state.currentBet} toAct=${state.currentPlayerPosition}`
  );
  console.log(`board: ${cardsToString(state.communityCards)}`);
}

function chooseAutoAction(state, playerPosition) {
  const actions = getValidActions(state, playerPosition);
  if (!actions.canAct) {
    throw new Error(
      `Player at position ${playerPosition} cannot act right now`
    );
  }

  // "Check the whole time" means: check if legal, otherwise call to continue.
  if (actions.canCheck) return { action: 'check', amount: 0 };
  if (actions.canCall) return { action: 'call', amount: 0 };

  // If this ever happens, it indicates a rules/state bug for this sim.
  throw new Error(
    `No check/call available for pos=${playerPosition}. ` +
      `callAmount=${actions.callAmount} chips=${state.players[playerPosition].chips} currentBet=${state.currentBet} playerBet=${state.players[playerPosition].currentBet}`
  );
}

function runSingleHandSimulation() {
  const base = createGameState({
    smallBlind: 5,
    bigBlind: 10,
    startingChips: 1000,
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Carol' },
    ],
  });

  let state = startNewHand(base);

  printStateHeader(state, 'HAND START');
  printStacks(state);

  // Betting + round progression loop
  while (state.currentRound !== ROUND.SHOWDOWN) {
    // Let players act until betting is complete.
    while (!isBettingRoundComplete(state)) {
      const pos = state.currentPlayerPosition;
      if (pos === null || pos === undefined) {
        throw new Error(
          `Unexpected: betting not complete but currentPlayerPosition is ${pos}`
        );
      }

      const player = state.players[pos];
      const { action, amount } = chooseAutoAction(state, pos);

      console.log(
        `\nACTION: ${player.name} (pos ${pos}) -> ${action}${amount ? ` ${amount}` : ''}`
      );
      state = processAction(state, pos, action, amount);

      // Useful snapshot
      console.log(
        `after: pot=${state.pot} currentBet=${state.currentBet} toAct=${state.currentPlayerPosition}`
      );
    }

    // Move to next round or showdown.
    if (shouldContinueToNextRound(state)) {
      state = advanceRound(state);
      printStateHeader(state, `ADVANCE -> ${state.currentRound.toUpperCase()}`);
      printStacks(state);
      continue;
    }

    // Go to showdown
    state = advanceRound(state);
    state = processShowdown(state);
    break;
  }

  printStateHeader(state, 'SHOWDOWN');
  console.log(`\n=== HOLE CARDS + HANDS ===`);
  for (const p of state.players) {
    const hole = cardsToString(p.holeCards);
    const evalResult = evaluateHand(p.holeCards, state.communityCards);
    console.log(
      `${p.position}:${p.name} hole=${hole} => ${evalResult.rankName} (${cardsToString(evalResult.cards)})`
    );
  }

  console.log(`\n=== WINNERS ===`);
  if (!Array.isArray(state.winners) || state.winners.length === 0) {
    console.log('No winners computed (unexpected).');
  } else {
    const winnerNames = state.winners
      .map((pos) => state.players.find((p) => p.position === pos))
      .filter(Boolean)
      .map((p) => `${p.position}:${p.name}`);

    console.log(
      `winners=${JSON.stringify(state.winners)} (${winnerNames.join(', ')})`
    );
  }

  console.log(`\n=== FINAL STACKS ===`);
  printStacks(state);
}

runSingleHandSimulation();
