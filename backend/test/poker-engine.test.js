/**
 * Tests for poker engine - card utilities, deck, and hand evaluation
 */

import { describe, test, expect } from 'bun:test';
const {
  createCard,
  createDeck,
  shuffleDeck,
  dealHoleCards,
  evaluateHand,
  compareHands,
  determineWinners,
  checkStraight,
  checkFlush,
  HAND_RANKINGS
} = require('../lib/poker-engine');

describe('Poker Engine - Card Utilities', () => {
  test('creates a valid card', () => {
    const card = createCard('A', 'hearts');
    expect(card.rank).toBe('A');
    expect(card.suit).toBe('hearts');
    expect(card.value).toBe(14);
  });
  
  test('creates a full deck of 52 cards', () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
    
    // Check we have all suits
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    
    // Check we have all ranks
    const ranks = new Set(deck.map(c => c.rank));
    expect(ranks.size).toBe(13);
  });
  
  test('shuffles deck without losing cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    
    expect(shuffled.length).toBe(52);
    expect(shuffled).not.toEqual(deck); // Extremely unlikely to be in same order
  });
  
  test('deals hole cards correctly', () => {
    const deck = shuffleDeck(createDeck());
    const result = dealHoleCards(deck, 3);
    
    expect(result.players.length).toBe(3);
    expect(result.players[0].length).toBe(2);
    expect(result.players[1].length).toBe(2);
    expect(result.players[2].length).toBe(2);
    expect(result.deck.length).toBe(46); // 52 - 6 dealt
  });
});

describe('Poker Engine - Hand Evaluation', () => {
  test('evaluates Royal Flush', () => {
    const holeCards = [
      createCard('A', 'hearts'),
      createCard('K', 'hearts')
    ];
    const communityCards = [
      createCard('Q', 'hearts'),
      createCard('J', 'hearts'),
      createCard('10', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.ROYAL_FLUSH);
    expect(result.rankName).toBe('Royal Flush');
  });
  
  test('evaluates Straight Flush', () => {
    const holeCards = [
      createCard('9', 'spades'),
      createCard('8', 'spades')
    ];
    const communityCards = [
      createCard('7', 'spades'),
      createCard('6', 'spades'),
      createCard('5', 'spades')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.STRAIGHT_FLUSH);
    expect(result.rankName).toBe('Straight Flush');
  });
  
  test('evaluates Four of a Kind', () => {
    const holeCards = [
      createCard('K', 'hearts'),
      createCard('K', 'diamonds')
    ];
    const communityCards = [
      createCard('K', 'clubs'),
      createCard('K', 'spades'),
      createCard('A', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.FOUR_OF_A_KIND);
    expect(result.rankName).toBe('Four of a Kind');
    expect(result.quads).toBe('K');
  });
  
  test('evaluates Full House', () => {
    const holeCards = [
      createCard('Q', 'hearts'),
      createCard('Q', 'diamonds')
    ];
    const communityCards = [
      createCard('Q', 'clubs'),
      createCard('8', 'spades'),
      createCard('8', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.FULL_HOUSE);
    expect(result.rankName).toBe('Full House');
    expect(result.trips).toBe('Q');
    expect(result.pair).toBe('8');
  });
  
  test('evaluates Flush', () => {
    const holeCards = [
      createCard('A', 'diamonds'),
      createCard('10', 'diamonds')
    ];
    const communityCards = [
      createCard('7', 'diamonds'),
      createCard('5', 'diamonds'),
      createCard('2', 'diamonds')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.FLUSH);
    expect(result.rankName).toBe('Flush');
  });
  
  test('evaluates Straight', () => {
    const holeCards = [
      createCard('9', 'hearts'),
      createCard('8', 'diamonds')
    ];
    const communityCards = [
      createCard('7', 'clubs'),
      createCard('6', 'spades'),
      createCard('5', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.STRAIGHT);
    expect(result.rankName).toBe('Straight');
  });
  
  test('evaluates Wheel (A-2-3-4-5 straight)', () => {
    const holeCards = [
      createCard('A', 'hearts'),
      createCard('2', 'diamonds')
    ];
    const communityCards = [
      createCard('3', 'clubs'),
      createCard('4', 'spades'),
      createCard('5', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.STRAIGHT);
    expect(result.rankName).toBe('Straight');
    expect(result.highCard).toBe(5);
  });
  
  test('evaluates Three of a Kind', () => {
    const holeCards = [
      createCard('J', 'hearts'),
      createCard('J', 'diamonds')
    ];
    const communityCards = [
      createCard('J', 'clubs'),
      createCard('A', 'spades'),
      createCard('K', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.THREE_OF_A_KIND);
    expect(result.rankName).toBe('Three of a Kind');
    expect(result.trips).toBe('J');
  });
  
  test('evaluates Two Pair', () => {
    const holeCards = [
      createCard('10', 'hearts'),
      createCard('10', 'diamonds')
    ];
    const communityCards = [
      createCard('5', 'clubs'),
      createCard('5', 'spades'),
      createCard('A', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.TWO_PAIR);
    expect(result.rankName).toBe('Two Pair');
    expect(result.pairs).toContain('10');
    expect(result.pairs).toContain('5');
  });
  
  test('evaluates One Pair', () => {
    const holeCards = [
      createCard('9', 'hearts'),
      createCard('9', 'diamonds')
    ];
    const communityCards = [
      createCard('A', 'clubs'),
      createCard('K', 'spades'),
      createCard('Q', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.PAIR);
    expect(result.rankName).toBe('Pair');
    expect(result.pair).toBe('9');
  });
  
  test('evaluates High Card', () => {
    const holeCards = [
      createCard('A', 'hearts'),
      createCard('K', 'diamonds')
    ];
    const communityCards = [
      createCard('Q', 'clubs'),
      createCard('J', 'spades'),
      createCard('9', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.HIGH_CARD);
    expect(result.rankName).toBe('High Card');
  });
});

describe('Poker Engine - Hand Comparison', () => {
  test('higher rank beats lower rank', () => {
    const flush = {
      rank: HAND_RANKINGS.FLUSH,
      value: 1000000
    };
    const straight = {
      rank: HAND_RANKINGS.STRAIGHT,
      value: 1000000
    };
    
    expect(compareHands(flush, straight)).toBe(1);
    expect(compareHands(straight, flush)).toBe(-1);
  });
  
  test('same rank compares by value', () => {
    const pair1 = {
      rank: HAND_RANKINGS.PAIR,
      value: 1400000 // Pair of Aces
    };
    const pair2 = {
      rank: HAND_RANKINGS.PAIR,
      value: 1300000 // Pair of Kings
    };
    
    expect(compareHands(pair1, pair2)).toBe(1);
    expect(compareHands(pair2, pair1)).toBe(-1);
  });
  
  test('identical hands tie', () => {
    const hand1 = {
      rank: HAND_RANKINGS.PAIR,
      value: 1400000
    };
    const hand2 = {
      rank: HAND_RANKINGS.PAIR,
      value: 1400000
    };
    
    expect(compareHands(hand1, hand2)).toBe(0);
  });
  
  test('Royal Flush beats everything', () => {
    const royalFlush = evaluateHand(
      [createCard('A', 'hearts'), createCard('K', 'hearts')],
      [createCard('Q', 'hearts'), createCard('J', 'hearts'), createCard('10', 'hearts')]
    );
    
    const straightFlush = evaluateHand(
      [createCard('9', 'spades'), createCard('8', 'spades')],
      [createCard('7', 'spades'), createCard('6', 'spades'), createCard('5', 'spades')]
    );
    
    expect(compareHands(royalFlush, straightFlush)).toBe(1);
  });
  
  test('kicker matters in pairs', () => {
    const pairAces1 = evaluateHand(
      [createCard('A', 'hearts'), createCard('A', 'diamonds')],
      [createCard('K', 'clubs'), createCard('Q', 'spades'), createCard('J', 'hearts')]
    );
    
    const pairAces2 = evaluateHand(
      [createCard('A', 'clubs'), createCard('A', 'spades')],
      [createCard('K', 'hearts'), createCard('Q', 'diamonds'), createCard('10', 'clubs')]
    );
    
    // First hand has J kicker, second has 10 kicker
    expect(compareHands(pairAces1, pairAces2)).toBe(1);
  });
});

describe('Poker Engine - Winner Determination', () => {
  test('determines single winner', () => {
    const players = [
      {
        holeCards: [createCard('A', 'hearts'), createCard('A', 'diamonds')]
      },
      {
        holeCards: [createCard('K', 'hearts'), createCard('K', 'diamonds')]
      },
      {
        holeCards: [createCard('Q', 'hearts'), createCard('Q', 'diamonds')]
      }
    ];
    
    const communityCards = [
      createCard('2', 'clubs'),
      createCard('7', 'spades'),
      createCard('9', 'hearts'),
      createCard('3', 'diamonds'),
      createCard('5', 'clubs')
    ];
    
    const winners = determineWinners(players, communityCards);
    expect(winners).toEqual([0]); // Player 0 has pair of Aces
  });
  
  test('determines multiple winners in tie', () => {
    const players = [
      {
        holeCards: [createCard('A', 'hearts'), createCard('K', 'hearts')]
      },
      {
        holeCards: [createCard('A', 'diamonds'), createCard('K', 'diamonds')]
      }
    ];
    
    const communityCards = [
      createCard('Q', 'clubs'),
      createCard('J', 'spades'),
      createCard('10', 'hearts'),
      createCard('9', 'clubs'),
      createCard('8', 'spades')
    ];
    
    const winners = determineWinners(players, communityCards);
    expect(winners.length).toBe(2);
    expect(winners).toContain(0);
    expect(winners).toContain(1);
  });
  
  test('flush beats straight', () => {
    const players = [
      {
        // Flush
        holeCards: [createCard('A', 'hearts'), createCard('10', 'hearts')]
      },
      {
        // Straight
        holeCards: [createCard('9', 'clubs'), createCard('8', 'diamonds')]
      }
    ];
    
    const communityCards = [
      createCard('7', 'hearts'),
      createCard('6', 'hearts'),
      createCard('5', 'hearts'),
      createCard('K', 'spades'),
      createCard('4', 'clubs')
    ];
    
    const winners = determineWinners(players, communityCards);
    expect(winners).toEqual([0]);
  });
});

describe('Poker Engine - Edge Cases', () => {
  test('handles fewer than 5 cards', () => {
    const holeCards = [
      createCard('A', 'hearts'),
      createCard('K', 'hearts')
    ];
    const communityCards = [
      createCard('Q', 'hearts')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.HIGH_CARD);
  });
  
  test('handles more than 5 community cards', () => {
    const holeCards = [
      createCard('A', 'hearts'),
      createCard('A', 'diamonds')
    ];
    const communityCards = [
      createCard('A', 'clubs'),
      createCard('K', 'spades'),
      createCard('K', 'hearts'),
      createCard('Q', 'diamonds'),
      createCard('J', 'clubs')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.FULL_HOUSE);
  });
  
  test('selects best 5-card hand from 7 cards', () => {
    const holeCards = [
      createCard('7', 'hearts'),
      createCard('2', 'clubs')
    ];
    const communityCards = [
      createCard('A', 'diamonds'),
      createCard('K', 'spades'),
      createCard('Q', 'hearts'),
      createCard('J', 'clubs'),
      createCard('10', 'diamonds')
    ];
    
    const result = evaluateHand(holeCards, communityCards);
    expect(result.rank).toBe(HAND_RANKINGS.STRAIGHT); // Should make A-K-Q-J-10
  });
});
