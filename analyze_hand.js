const { evaluateHand } = require('./backend/lib/poker-engine');

// Community cards
const community = [
  { rank: '3', suit: 'spades', value: 3 },
  { rank: 'J', suit: 'spades', value: 11 },
  { rank: '10', suit: 'clubs', value: 10 },
  { rank: '4', suit: 'hearts', value: 4 },
  { rank: '9', suit: 'spades', value: 9 }
];

// Player 0: bill
const hand0 = [
  { rank: '6', suit: 'diamonds', value: 6 },
  { rank: '9', suit: 'clubs', value: 9 }
];

// Player 1: BotPlayer
const hand1 = [
  { rank: '5', suit: 'diamonds', value: 5 },
  { rank: '7', suit: 'clubs', value: 7 }
];

console.log('Community Cards: 3♠ J♠ 10♣ 4♥ 9♠');
console.log('');

console.log('Player 0 (bill) Hand: 6♦ 9♣');
const eval0 = evaluateHand(hand0, community);
console.log('Evaluation:', JSON.stringify(eval0, null, 2));

console.log('\nPlayer 1 (BotPlayer) Hand: 5♦ 7♣');
const eval1 = evaluateHand(hand1, community);
console.log('Evaluation:', JSON.stringify(eval1, null, 2));

console.log('\n=== WINNER ===');
if (eval0.rank > eval1.rank) {
  console.log('Player 0 (bill) should win with:', eval0.rankName);
  console.log('  bill value:', eval0.value);
  console.log('  BotPlayer value:', eval1.value);
} else if (eval1.rank > eval0.rank) {
  console.log('Player 1 (BotPlayer) should win with:', eval1.rankName);
  console.log('  BotPlayer value:', eval1.value);
  console.log('  bill value:', eval0.value);
} else {
  console.log('Same rank - comparing values');
  if (eval0.value > eval1.value) {
    console.log('Player 0 (bill) wins by kicker');
  } else if (eval1.value > eval0.value) {
    console.log('Player 1 (BotPlayer) wins by kicker');
  } else {
    console.log('Complete tie');
  }
}

console.log('\nBUT THE DATABASE SAYS: Winner is Player 1 (position 1)');
