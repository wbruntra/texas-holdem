/**
 * Migration: Create players table
 */
exports.up = function(knex) {
  return knex.schema.createTable('players', function(table) {
    table.increments('id').primary();
    table.integer('game_id').unsigned().notNullable().references('id').inTable('games').onDelete('CASCADE')
    table.string('name').notNullable();
    table.integer('position').notNullable();
    table.integer('chips').notNullable().defaultTo(1000);
    table.integer('current_bet').notNullable().defaultTo(0);
    table.json('hole_cards').nullable();
    table.enum('status', ['active', 'folded', 'all_in', 'out']).notNullable().defaultTo('active');
    table.uuid('session_token').notNullable().unique();
    table.boolean('is_dealer').notNullable().defaultTo(false);
    table.boolean('is_small_blind').notNullable().defaultTo(false);
    table.boolean('is_big_blind').notNullable().defaultTo(false);
    table.enum('last_action', ['fold', 'check', 'call', 'bet', 'raise', 'all_in']).nullable();
    table.boolean('connected').notNullable().defaultTo(true);
    table.timestamps(true, true);
    
    table.index('game_id');
    table.index('session_token');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('players');
};
