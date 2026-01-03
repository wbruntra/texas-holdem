/**
 * Migration: Add showdown_processed column to games table
 * 
 * This prevents double pot payout bug by tracking whether showdown has been processed.
 * The flag is persisted to database so it survives game state reloads.
 */
exports.up = function(knex) {
  return knex.schema.table('games', function(table) {
    table.boolean('showdown_processed').notNullable().defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('games', function(table) {
    table.dropColumn('showdown_processed');
  });
};
