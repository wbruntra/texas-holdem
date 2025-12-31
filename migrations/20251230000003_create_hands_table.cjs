/**
 * Migration: Create hands table (hand history)
 */
exports.up = function(knex) {
  return knex.schema.createTable('hands', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(16))))'));
    table.uuid('game_id').notNullable().references('id').inTable('games').onDelete('CASCADE');
    table.integer('hand_number').notNullable();
    table.integer('dealer_position').notNullable();
    table.json('winners').nullable(); // Array of player IDs
    table.integer('pot_amount').nullable();
    table.json('community_cards').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);
    
    table.index('game_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('hands');
};
