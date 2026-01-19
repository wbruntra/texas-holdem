/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.dropTable('showdown_history');
};


exports.down = function(knex) {
  return knex.schema.createTable('showdown_history', function(table) {
    table.increments('id').primary();
    table.integer('game_id').unsigned().notNullable().references('id').inTable('games').onDelete('CASCADE');
    table.integer('hand_id').unsigned().notNullable().references('id').inTable('hands').onDelete('CASCADE');
    table.integer('hand_number').notNullable();
    table.json('community_cards').nullable();
    table.json('player_info').nullable(); // Array of player objects with raw data
    table.json('pot_breakdown').nullable(); // Array of pots for debugging
    table.timestamps(true, true);
    
    table.index('game_id');
    table.index('hand_id');
    table.index('hand_number');
  });
};

