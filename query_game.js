const knex = require('knex');
const config = require('./knexfile.js');
const db = knex(config.development);

(async () => {
  try {
    const game = await db('games').where({ room_code: '7VRRNC' }).first();
    if (!game) {
      console.log('Game not found');
      process.exit(0);
    }
    
    console.log('=== GAME STATE ===');
    console.log('Game ID:', game.id);
    console.log('Status:', game.status);
    console.log('Current Round:', game.current_round);
    console.log('Pot:', game.pot);
    console.log('Pots:', game.pots);
    console.log('Community Cards:', game.community_cards);
    console.log('Dealer Position:', game.dealer_position);
    console.log('Small Blind:', game.small_blind);
    console.log('Big Blind:', game.big_blind);
    console.log('Winners:', game.winners);
    
    console.log('\n=== PLAYERS ===');
    const players = await db('players').where({ game_id: game.id }).orderBy('position');
    players.forEach(p => {
      console.log(`\nPosition ${p.position}: ${p.username}`);
      console.log('  Stack:', p.stack);
      console.log('  All-in:', p.all_in);
      console.log('  Folded:', p.is_folded);
      console.log('  Total Bet:', p.total_bet);
      console.log('  Hand:', p.hand);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
