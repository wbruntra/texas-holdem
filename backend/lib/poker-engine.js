/**
 * Core poker engine - handles cards, deck, and hand evaluation
 */

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// Hand rankings (higher is better)
const HAND_RANKINGS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

/**
 * Create a card object
 * @param {string} rank - Card rank (2-10, J, Q, K, A)
 * @param {string} suit - Card suit (hearts, diamonds, clubs, spades)
 * @returns {Object} Card object
 */
function createCard(rank, suit) {
  return {
    rank,
    suit,
    value: RANK_VALUES[rank],
    toString() {
      const suitSymbols = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠'
      };
      return `${rank}${suitSymbols[suit]}`;
    }
  };
}

/**
 * Create a new deck of 52 cards
 * @returns {Array} Array of card objects
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit));
    }
  }
  return deck;
}

/**
 * Shuffle a deck using Fisher-Yates algorithm
 * @param {Array} deck - Deck of cards
 * @returns {Array} Shuffled deck
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal hole cards to players
 * @param {Array} deck - Shuffled deck
 * @param {number} numPlayers - Number of players
 * @returns {Object} Object with players array and remaining deck
 */
function dealHoleCards(deck, numPlayers) {
  const players = Array(numPlayers).fill(null).map(() => []);
  let deckIndex = 0;
  
  // Deal 2 cards to each player
  for (let i = 0; i < 2; i++) {
    for (let p = 0; p < numPlayers; p++) {
      players[p].push(deck[deckIndex++]);
    }
  }
  
  return {
    players,
    deck: deck.slice(deckIndex)
  };
}

/**
 * Count occurrences of each rank in a hand
 * @param {Array} cards - Array of cards
 * @returns {Object} Map of rank to count
 */
function countRanks(cards) {
  const counts = {};
  for (const card of cards) {
    counts[card.rank] = (counts[card.rank] || 0) + 1;
  }
  return counts;
}

/**
 * Count occurrences of each suit in a hand
 * @param {Array} cards - Array of cards
 * @returns {Object} Map of suit to count
 */
function countSuits(cards) {
  const counts = {};
  for (const card of cards) {
    counts[card.suit] = (counts[card.suit] || 0) + 1;
  }
  return counts;
}

/**
 * Check if cards form a straight
 * @param {Array} cards - Array of cards (should be sorted by value)
 * @returns {boolean|number} False or highest card value of straight
 */
function checkStraight(cards) {
  const values = [...new Set(cards.map(c => c.value))].sort((a, b) => b - a);
  
  if (values.length < 5) return false;
  
  // Check for regular straight
  for (let i = 0; i <= values.length - 5; i++) {
    let isStraight = true;
    for (let j = 0; j < 4; j++) {
      if (values[i + j] - values[i + j + 1] !== 1) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) return values[i]; // Return highest card of straight
  }
  
  // Check for A-2-3-4-5 straight (wheel)
  if (values.includes(14) && values.includes(2) && values.includes(3) && 
      values.includes(4) && values.includes(5)) {
    return 5; // In wheel, 5 is high card
  }
  
  return false;
}

/**
 * Check if cards form a flush
 * @param {Array} cards - Array of cards
 * @returns {boolean|Array} False or array of flush cards
 */
function checkFlush(cards) {
  const suitCounts = countSuits(cards);
  for (const suit in suitCounts) {
    if (suitCounts[suit] >= 5) {
      return cards.filter(c => c.suit === suit)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }
  }
  return false;
}

/**
 * Evaluate a poker hand and return its ranking
 * @param {Array} holeCards - Player's 2 hole cards
 * @param {Array} communityCards - Community cards (0-5 cards)
 * @returns {Object} Hand evaluation result
 */
function evaluateHand(holeCards, communityCards = []) {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    return {
      rank: HAND_RANKINGS.HIGH_CARD,
      rankName: 'High Card',
      value: 0,
      cards: allCards.sort((a, b) => b.value - a.value)
    };
  }
  
  const rankCounts = countRanks(allCards);
  const sortedCards = [...allCards].sort((a, b) => b.value - a.value);
  
  // Group cards by count
  const groups = {};
  for (const rank in rankCounts) {
    const count = rankCounts[rank];
    if (!groups[count]) groups[count] = [];
    groups[count].push({
      rank,
      value: RANK_VALUES[rank],
      count
    });
  }
  
  // Sort groups by card value
  for (const count in groups) {
    groups[count].sort((a, b) => b.value - a.value);
  }
  
  const flush = checkFlush(allCards);
  const straight = checkStraight(allCards);
  
  // Check for straight flush
  if (flush && straight) {
    const flushCards = flush;
    const straightCheck = checkStraight(flushCards);
    if (straightCheck) {
      const isRoyal = flushCards[0].value === 14 && straightCheck === 14;
      return {
        rank: isRoyal ? HAND_RANKINGS.ROYAL_FLUSH : HAND_RANKINGS.STRAIGHT_FLUSH,
        rankName: isRoyal ? 'Royal Flush' : 'Straight Flush',
        value: straightCheck * 100000,
        cards: flushCards.slice(0, 5),
        highCard: straightCheck
      };
    }
  }
  
  // Four of a kind
  if (groups[4]) {
    const quads = groups[4][0];
    const kicker = sortedCards.find(c => c.rank !== quads.rank);
    return {
      rank: HAND_RANKINGS.FOUR_OF_A_KIND,
      rankName: 'Four of a Kind',
      value: quads.value * 100000 + kicker.value,
      cards: allCards.filter(c => c.rank === quads.rank).concat([kicker]),
      quads: quads.rank
    };
  }
  
  // Full house
  if (groups[3] && (groups[2] || groups[3].length > 1)) {
    const trips = groups[3][0];
    const pair = groups[2] ? groups[2][0] : groups[3][1];
    return {
      rank: HAND_RANKINGS.FULL_HOUSE,
      rankName: 'Full House',
      value: trips.value * 100000 + pair.value,
      cards: allCards.filter(c => c.rank === trips.rank || c.rank === pair.rank).slice(0, 5),
      trips: trips.rank,
      pair: pair.rank
    };
  }
  
  // Flush
  if (flush) {
    const flushValue = flush.reduce((sum, card, i) => sum + card.value * Math.pow(100, 4 - i), 0);
    return {
      rank: HAND_RANKINGS.FLUSH,
      rankName: 'Flush',
      value: flushValue,
      cards: flush.slice(0, 5)
    };
  }
  
  // Straight
  if (straight) {
    return {
      rank: HAND_RANKINGS.STRAIGHT,
      rankName: 'Straight',
      value: straight * 100000,
      cards: sortedCards.slice(0, 5),
      highCard: straight
    };
  }
  
  // Three of a kind
  if (groups[3]) {
    const trips = groups[3][0];
    const kickers = sortedCards.filter(c => c.rank !== trips.rank).slice(0, 2);
    return {
      rank: HAND_RANKINGS.THREE_OF_A_KIND,
      rankName: 'Three of a Kind',
      value: trips.value * 100000 + kickers[0].value * 100 + (kickers[1]?.value || 0),
      cards: allCards.filter(c => c.rank === trips.rank).concat(kickers),
      trips: trips.rank
    };
  }
  
  // Two pair
  if (groups[2] && groups[2].length >= 2) {
    const pair1 = groups[2][0];
    const pair2 = groups[2][1];
    const kicker = sortedCards.find(c => c.rank !== pair1.rank && c.rank !== pair2.rank);
    return {
      rank: HAND_RANKINGS.TWO_PAIR,
      rankName: 'Two Pair',
      value: pair1.value * 10000 + pair2.value * 100 + (kicker?.value || 0),
      cards: allCards.filter(c => c.rank === pair1.rank || c.rank === pair2.rank)
        .concat(kicker ? [kicker] : []).slice(0, 5),
      pairs: [pair1.rank, pair2.rank]
    };
  }
  
  // One pair
  if (groups[2]) {
    const pair = groups[2][0];
    const kickers = sortedCards.filter(c => c.rank !== pair.rank).slice(0, 3);
    return {
      rank: HAND_RANKINGS.PAIR,
      rankName: 'Pair',
      value: pair.value * 100000 + kickers.reduce((sum, card, i) => 
        sum + card.value * Math.pow(100, 2 - i), 0),
      cards: allCards.filter(c => c.rank === pair.rank).concat(kickers),
      pair: pair.rank
    };
  }
  
  // High card
  const topFive = sortedCards.slice(0, 5);
  const highCardValue = topFive.reduce((sum, card, i) => 
    sum + card.value * Math.pow(100, 4 - i), 0);
  return {
    rank: HAND_RANKINGS.HIGH_CARD,
    rankName: 'High Card',
    value: highCardValue,
    cards: topFive
  };
}

/**
 * Compare two hands to determine winner
 * @param {Object} hand1 - First hand evaluation
 * @param {Object} hand2 - Second hand evaluation
 * @returns {number} 1 if hand1 wins, -1 if hand2 wins, 0 if tie
 */
function compareHands(hand1, hand2) {
  if (hand1.rank !== hand2.rank) {
    return hand1.rank > hand2.rank ? 1 : -1;
  }
  
  // Same rank, compare values
  if (hand1.value !== hand2.value) {
    return hand1.value > hand2.value ? 1 : -1;
  }
  
  return 0; // Tie
}

/**
 * Determine winners from multiple players
 * @param {Array} players - Array of {holeCards, ...} objects
 * @param {Array} communityCards - Community cards
 * @returns {Array} Array of winner indices
 */
function determineWinners(players, communityCards) {
  const evaluations = players.map((player, index) => ({
    index,
    hand: evaluateHand(player.holeCards, communityCards),
    player
  }));
  
  // Find best hand
  let bestHand = evaluations[0].hand;
  for (let i = 1; i < evaluations.length; i++) {
    const comparison = compareHands(evaluations[i].hand, bestHand);
    if (comparison > 0) {
      bestHand = evaluations[i].hand;
    }
  }
  
  // Find all players with best hand (handles ties)
  const winners = evaluations
    .filter(e => compareHands(e.hand, bestHand) === 0)
    .map(e => e.index);
  
  return winners;
}

module.exports = {
  SUITS,
  RANKS,
  RANK_VALUES,
  HAND_RANKINGS,
  createCard,
  createDeck,
  shuffleDeck,
  dealHoleCards,
  evaluateHand,
  compareHands,
  determineWinners,
  countRanks,
  countSuits,
  checkStraight,
  checkFlush
};
