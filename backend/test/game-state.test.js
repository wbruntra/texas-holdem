/**
 * Tests for game state machine and betting logic
 */

import { describe, test, expect } from 'bun:test';
const {
  GAME_STATUS,
  ROUND,
  PLAYER_STATUS,
  ACTION_TYPE,
  createGameState,
  startNewHand,
  getNextActivePosition,
  shouldAutoAdvance,
  isBettingRoundComplete,
  advanceRound,
  processShowdown,
  shouldContinueToNextRound,
} = require('../lib/game-state-machine');

const {
  validateAction,
  processAction,
  getValidActions,
} = require('../lib/betting-logic');

describe('Game State Machine - Initialization', () => {
  test('creates initial game state', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];

    const state = createGameState({ players });

    expect(state.status).toBe(GAME_STATUS.WAITING);
    expect(state.players.length).toBe(3);
    expect(state.players[0].chips).toBe(1000);
    expect(state.smallBlind).toBe(5);
    expect(state.bigBlind).toBe(10);
  });

  test('creates game with custom blinds', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    const state = createGameState({
      players,
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 500,
    });

    expect(state.smallBlind).toBe(10);
    expect(state.bigBlind).toBe(20);
    expect(state.players[0].chips).toBe(500);
  });
});

describe('Game State Machine - Hand Start', () => {
  test('starts first hand correctly', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    expect(state.status).toBe(GAME_STATUS.ACTIVE);
    expect(state.currentRound).toBe(ROUND.PREFLOP);
    expect(state.handNumber).toBe(1);
    expect(state.pot).toBe(15); // 5 + 10 blinds
    expect(state.currentBet).toBe(10); // big blind

    // Check dealer, small blind, big blind assignments (3+ players)
    expect(state.players[0].isDealer).toBe(true);
    expect(state.players[1].isSmallBlind).toBe(true);
    expect(state.players[2].isBigBlind).toBe(true);

    // Check blinds posted
    expect(state.players[1].currentBet).toBe(5);
    expect(state.players[2].currentBet).toBe(10);
    expect(state.players[1].chips).toBe(995);
    expect(state.players[2].chips).toBe(990);

    // Check hole cards dealt
    expect(state.players[0].holeCards.length).toBe(2);
    expect(state.players[1].holeCards.length).toBe(2);
    expect(state.players[2].holeCards.length).toBe(2);

    // First to act is left of big blind (player 0)
    expect(state.currentPlayerPosition).toBe(0);
  });

  test('rotates dealer button', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const firstDealer = state.dealerPosition;

    // Complete hand and start new one
    state.currentRound = ROUND.SHOWDOWN;
    state = startNewHand(state);

    expect(state.dealerPosition).toBe((firstDealer + 1) % 3);
  });

  test('handles player all-in on blinds', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];

    let state = createGameState({ players, startingChips: 7 });
    state = startNewHand(state);

    // Small blind should be all-in with 7 chips
    expect(state.players[1].chips).toBe(2); // 7 - 5
    expect(state.players[2].chips).toBe(0); // All-in for big blind
    expect(state.players[2].status).toBe(PLAYER_STATUS.ALL_IN);
  });
});

describe('Game State Machine - Round Progression', () => {
  test('advances from preflop to flop', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    state.currentRound = ROUND.PREFLOP;

    // Mark betting complete
    state.players[0].lastAction = ACTION_TYPE.CALL;
    state.players[1].lastAction = ACTION_TYPE.CHECK;
    state.players[0].currentBet = 10;

    state = advanceRound(state);

    expect(state.currentRound).toBe(ROUND.FLOP);
    expect(state.communityCards.length).toBe(3);
    expect(state.currentBet).toBe(0);
    expect(state.players[0].currentBet).toBe(0);
    expect(state.players[1].currentBet).toBe(0);
  });

  test('advances from flop to turn', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    state.currentRound = ROUND.FLOP;
    state.communityCards = [
      { rank: 'A', suit: 'hearts' },
      { rank: 'K', suit: 'diamonds' },
      { rank: 'Q', suit: 'clubs' },
    ];

    state = advanceRound(state);

    expect(state.currentRound).toBe(ROUND.TURN);
    expect(state.communityCards.length).toBe(4);
  });

  test('advances from turn to river', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    state.currentRound = ROUND.TURN;
    state.communityCards = [
      { rank: 'A', suit: 'hearts' },
      { rank: 'K', suit: 'diamonds' },
      { rank: 'Q', suit: 'clubs' },
      { rank: 'J', suit: 'spades' },
    ];

    state = advanceRound(state);

    expect(state.currentRound).toBe(ROUND.RIVER);
    expect(state.communityCards.length).toBe(5);
  });

  test('does not assign turn to all-in player after advancing round', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // Simulate Alice being all-in before the next round begins
    state.players[0].status = PLAYER_STATUS.ALL_IN;
    state.dealerPosition = 0;
    state.currentRound = ROUND.FLOP;

    const next = advanceRound(state);

    // Only Bob can act
    expect(next.currentPlayerPosition).toBe(1);
  });

  test('advances from river to showdown', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    state.currentRound = ROUND.RIVER;

    state = advanceRound(state);

    expect(state.currentRound).toBe(ROUND.SHOWDOWN);
    expect(state.currentPlayerPosition).toBe(null);
  });
});

describe('Game State Machine - Betting Round Completion', () => {
  test('detects incomplete betting round', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // No one has acted yet
    expect(isBettingRoundComplete(state)).toBe(false);
  });

  test('detects complete betting round', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // Both players have acted and matched
    state.players[0].lastAction = ACTION_TYPE.CALL;
    state.players[0].currentBet = 10;
    state.players[1].lastAction = ACTION_TYPE.CHECK;
    state.players[1].currentBet = 10;

    expect(isBettingRoundComplete(state)).toBe(true);
  });

  test('detects round complete when only one active player', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // One player folded
    state.players[0].status = PLAYER_STATUS.FOLDED;

    expect(isBettingRoundComplete(state)).toBe(true);
  });
});

describe('Betting Logic - Action Validation', () => {
  test('validates fold action', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    // In heads-up, player 0 is dealer/small blind and acts first

    const result = validateAction(
      state,
      state.currentPlayerPosition,
      ACTION_TYPE.FOLD
    );
    expect(result.valid).toBe(true);
  });

  test('validates check when no bet', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;
    state.currentBet = 0;
    state.players[currentPos].currentBet = 0;

    const result = validateAction(state, currentPos, ACTION_TYPE.CHECK);
    expect(result.valid).toBe(true);
  });

  test('rejects check when bet exists', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    // In heads-up, small blind needs to call or raise the big blind
    const currentPos = state.currentPlayerPosition;

    const result = validateAction(state, currentPos, ACTION_TYPE.CHECK);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot check');
  });

  test('validates call with sufficient chips', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;

    const result = validateAction(state, currentPos, ACTION_TYPE.CALL);
    expect(result.valid).toBe(true);
  });

  test('validates raise', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;

    const result = validateAction(state, currentPos, ACTION_TYPE.RAISE, 20);
    expect(result.valid).toBe(true);
  });

  test('rejects raise below minimum', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    state.lastRaise = 10;
    const currentPos = state.currentPlayerPosition;

    const result = validateAction(state, currentPos, ACTION_TYPE.RAISE, 5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Minimum raise');
  });

  test('rejects action when not player turn', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    state.currentPlayerPosition = 0;

    const result = validateAction(state, 1, ACTION_TYPE.FOLD);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Not your turn');
  });
});

describe('Betting Logic - Action Processing', () => {
  test('processes fold action', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;

    state = processAction(state, currentPos, ACTION_TYPE.FOLD);

    expect(state.players[currentPos].status).toBe(PLAYER_STATUS.FOLDED);
    expect(state.players[currentPos].lastAction).toBe(ACTION_TYPE.FOLD);
  });

  test('processes call action', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;

    const initialChips = state.players[currentPos].chips;
    const callAmount = state.currentBet - state.players[currentPos].currentBet;

    state = processAction(state, currentPos, ACTION_TYPE.CALL);

    expect(state.players[currentPos].chips).toBe(initialChips - callAmount);
    expect(state.players[currentPos].currentBet).toBeGreaterThanOrEqual(
      callAmount
    );
    expect(state.players[currentPos].lastAction).toBe(ACTION_TYPE.CALL);
  });

  test('processes raise action', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;

    const raiseAmount = 20;
    const initialChips = state.players[currentPos].chips;
    const callAmount = state.currentBet - state.players[currentPos].currentBet;

    state = processAction(state, currentPos, ACTION_TYPE.RAISE, raiseAmount);

    expect(state.players[currentPos].chips).toBe(
      initialChips - callAmount - raiseAmount
    );
    expect(state.currentBet).toBe(state.players[currentPos].currentBet);
    expect(state.players[currentPos].lastAction).toBe(ACTION_TYPE.RAISE);
    expect(state.lastRaise).toBe(raiseAmount);
  });

  test('processes all-in action', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;

    const initialChips = state.players[currentPos].chips;

    state = processAction(state, currentPos, ACTION_TYPE.ALL_IN);

    expect(state.players[currentPos].chips).toBe(0);
    expect(state.players[currentPos].status).toBe(PLAYER_STATUS.ALL_IN);
    expect(state.pot).toBeGreaterThan(15); // Initial pot was 15
  });

  test('advances to next player after action', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    const currentPos = state.currentPlayerPosition;
    state = processAction(state, currentPos, ACTION_TYPE.CALL);

    expect(state.currentPlayerPosition).not.toBe(currentPos);
  });
});

describe('Betting Logic - Valid Actions', () => {
  test('returns valid actions for current player', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);
    const currentPos = state.currentPlayerPosition;

    const actions = getValidActions(state, currentPos);

    expect(actions.canAct).toBe(true);
    expect(actions.canFold).toBe(true);
    expect(actions.canCall).toBe(true);
    // In heads-up, small blind (5) needs to call to match big blind (10)
    expect(actions.callAmount).toBe(5);
  });

  test('returns no actions for player not in turn', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    const notCurrentPos = (state.currentPlayerPosition + 1) % 2;
    const actions = getValidActions(state, notCurrentPos);

    expect(actions.canAct).toBe(false);
  });
});

describe('Game State Machine - Showdown', () => {
  test('determines winner and distributes pot', () => {
    const { createCard } = require('../lib/poker-engine');

    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // Set up hands and bets
    state.players[0].totalBet = 50;
    state.players[1].totalBet = 50;
    state.players[0].holeCards = [
      createCard('A', 'hearts'),
      createCard('A', 'diamonds'),
    ];
    state.players[1].holeCards = [
      createCard('K', 'hearts'),
      createCard('K', 'diamonds'),
    ];

    state.communityCards = [
      createCard('2', 'clubs'),
      createCard('7', 'spades'),
      createCard('9', 'hearts'),
      createCard('3', 'diamonds'),
      createCard('5', 'clubs'),
    ];

    state.pot = 100;

    state = processShowdown(state);

    expect(state.winners).toEqual([0]); // Alice wins with pair of Aces
    expect(state.players[0].chips).toBeGreaterThan(990); // Won the pot
    expect(state.pot).toBe(0);
  });

  test('splits pot on tie', () => {
    const { createCard } = require('../lib/poker-engine');

    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // Set up bets
    state.players[0].totalBet = 50;
    state.players[1].totalBet = 50;

    // Both have same hand
    state.players[0].holeCards = [
      createCard('A', 'hearts'),
      createCard('K', 'hearts'),
    ];
    state.players[1].holeCards = [
      createCard('A', 'diamonds'),
      createCard('K', 'diamonds'),
    ];

    state.communityCards = [
      createCard('Q', 'clubs'),
      createCard('J', 'spades'),
      createCard('10', 'hearts'),
      createCard('9', 'clubs'),
      createCard('8', 'spades'),
    ];

    state.pot = 100;
    const initialChips0 = state.players[0].chips;
    const initialChips1 = state.players[1].chips;

    state = processShowdown(state);

    expect(state.winners.length).toBe(2);
    expect(state.players[0].chips).toBe(initialChips0 + 50);
    expect(state.players[1].chips).toBe(initialChips1 + 50);
  });
});

describe('Game State Machine - Auto Advance', () => {
  test('should auto-advance when everyone is all-in', () => {
    const state = createGameState({
      players: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ],
    });

    let gameState = startNewHand(state);
    gameState.currentRound = ROUND.FLOP;
    gameState.players[0].status = PLAYER_STATUS.ALL_IN;
    gameState.players[1].status = PLAYER_STATUS.ALL_IN;
    gameState.players[2].status = PLAYER_STATUS.ALL_IN;

    expect(shouldAutoAdvance(gameState)).toBe(true);
  });

  test('should auto-advance when only one player can bet and they have acted', () => {
    const state = createGameState({
      players: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ],
    });

    let gameState = startNewHand(state);
    gameState.currentRound = ROUND.FLOP;
    gameState.currentBet = 100;
    gameState.players[0].status = PLAYER_STATUS.ACTIVE;
    gameState.players[0].currentBet = 100; // has matched
    gameState.players[1].status = PLAYER_STATUS.ALL_IN;
    gameState.players[2].status = PLAYER_STATUS.FOLDED;

    expect(shouldAutoAdvance(gameState)).toBe(true);
  });

  test('should not auto-advance when only one player can bet but has not acted', () => {
    const state = createGameState({
      players: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ],
    });

    let gameState = startNewHand(state);
    gameState.currentRound = ROUND.FLOP;
    gameState.currentBet = 100;
    gameState.players[0].status = PLAYER_STATUS.ACTIVE;
    gameState.players[0].currentBet = 50; // has not matched
    gameState.players[1].status = PLAYER_STATUS.ALL_IN;

    expect(shouldAutoAdvance(gameState)).toBe(false);
  });

  test('should not auto-advance when multiple players can bet', () => {
    const state = createGameState({
      players: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ],
    });

    let gameState = startNewHand(state);
    gameState.currentRound = ROUND.FLOP;
    gameState.players[0].status = PLAYER_STATUS.ACTIVE;
    gameState.players[0].chips = 500;
    gameState.players[1].status = PLAYER_STATUS.ACTIVE;
    gameState.players[1].chips = 500;
    gameState.players[2].status = PLAYER_STATUS.FOLDED;

    expect(shouldAutoAdvance(gameState)).toBe(false);
  });

  test('should auto-advance when only one player left', () => {
    const state = createGameState({
      players: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ],
    });

    let gameState = startNewHand(state);
    gameState.currentRound = ROUND.FLOP;
    gameState.players[0].status = PLAYER_STATUS.ACTIVE;
    gameState.players[1].status = PLAYER_STATUS.FOLDED;
    gameState.players[2].status = PLAYER_STATUS.FOLDED;

    expect(shouldAutoAdvance(gameState)).toBe(true);
  });

  test('should not auto-advance at showdown', () => {
    const state = createGameState({
      players: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ],
    });

    let gameState = startNewHand(state);
    gameState.currentRound = ROUND.SHOWDOWN;
    gameState.players[0].status = PLAYER_STATUS.ALL_IN;
    gameState.players[1].status = PLAYER_STATUS.ALL_IN;

    expect(shouldAutoAdvance(gameState)).toBe(false);
  });
});

describe('Betting Logic - Call All-In (Short Stack)', () => {
  test('allows call when stack is smaller than bet amount', () => {
    const { validateAction } = require('../lib/betting-logic');

    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // Alice bets 50, Bob only has 25 chips
    state.currentBet = 50;
    state.players[0].currentBet = 50;
    state.players[0].chips = 950; // Alice has 950 left after betting 50
    state.players[1].chips = 25; // Bob only has 25
    state.players[1].currentBet = 0;
    state.currentPlayerPosition = 1; // Bob's turn

    const result = validateAction(state, 1, ACTION_TYPE.CALL);
    expect(result.valid).toBe(true);
  });

  test('processes call going all-in with short stack', () => {
    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    // Alice bets 50, Bob only has 25 chips
    state.currentBet = 50;
    state.players[0].currentBet = 50;
    state.players[0].chips = 950; // Alice has 950 left
    state.players[1].chips = 25; // Bob only has 25
    state.players[1].currentBet = 0;
    state.currentPlayerPosition = 1;
    state.pot = 50; // Alice's bet

    state = processAction(state, 1, ACTION_TYPE.CALL);

    expect(state.players[1].chips).toBe(0); // Bob all-in
    expect(state.players[1].currentBet).toBe(25); // Only his available chips
    expect(state.pot).toBe(75); // 50 from Alice + 25 from Bob
    expect(state.players[1].status).toBe(PLAYER_STATUS.ALL_IN);
  });

  test('getValidActions shows correct callAmount for short stack', () => {
    const { getValidActions } = require('../lib/betting-logic');

    const players = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    let state = createGameState({ players });
    state = startNewHand(state);

    state.currentBet = 50;
    state.players[0].currentBet = 50;
    state.players[0].chips = 950;
    state.players[1].chips = 25; // Bob only has 25
    state.players[1].currentBet = 0;
    state.currentPlayerPosition = 1;

    const actions = getValidActions(state, 1);

    expect(actions.canCall).toBe(true);
    expect(actions.callAmount).toBe(25); // Only his available chips, not full 50
  });
});
