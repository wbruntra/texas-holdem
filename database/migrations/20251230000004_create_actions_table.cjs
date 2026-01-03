/**
 * Migration: Create actions table (action history)
 */
exports.up = function(knex) {
  return knex.schema.createTable('actions', function(table) {
    table.increments('id').primary();
    table.integer('hand_id').unsigned().notNullable().references('id').inTable('hands').onDelete('CASCADE');
    table.integer('player_id').unsigned().notNullable().references('id').inTable('players').onDelete('CASCADE')
    table.enum('action_type', ['fold', 'check', 'call', 'bet', 'raise', 'all_in', 'small_blind', 'big_blind']).notNullable();
    table.integer('amount').notNullable().defaultTo(0);
    table.enum('round', ['preflop', 'flop', 'turn', 'river']).notNullable();
    table.timestamps(true, true);
    
    table.index('hand_id');
    table.index('player_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('actions');
};
