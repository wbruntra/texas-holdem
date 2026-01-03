/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('games', function(table) {
    table.json('pots').nullable();
    table.json('total_bet').nullable(); // Track totalBet per player in JSON
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('games', function(table) {
    table.dropColumn('pots');
    table.dropColumn('total_bet');
  });
};
