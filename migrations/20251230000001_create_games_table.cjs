/**
 * Migration: Create games table
 */
exports.up = function(knex) {
  return knex.schema.createTable('games', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(16))))'));
    table.string('room_code', 6).notNullable().unique();
    table.enum('status', ['waiting', 'active', 'completed']).notNullable().defaultTo('waiting');
    table.integer('small_blind').notNullable().defaultTo(5);
    table.integer('big_blind').notNullable().defaultTo(10);
    table.integer('starting_chips').notNullable().defaultTo(1000);
    table.integer('dealer_position').notNullable().defaultTo(0);
    table.enum('current_round', ['preflop', 'flop', 'turn', 'river', 'showdown']).nullable();
    table.integer('pot').notNullable().defaultTo(0);
    table.json('community_cards').nullable();
    table.integer('current_bet').notNullable().defaultTo(0);
    table.integer('current_player_position').nullable();
    table.integer('hand_number').notNullable().defaultTo(0);
    table.integer('last_raise').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('games');
};
