/**
 * Migration: Add action_finished column to games table
 * 
 * Tracks whether the current betting round has ended in an all-in situation.
 * When true, indicates players must manually advance to deal community cards.
 */

exports.up = function(knex) {
  return knex.schema.alterTable('games', function(table) {
    table.boolean('action_finished').notNullable().default(false)
  })
}

exports.down = function(knex) {
  return knex.schema.alterTable('games', function(table) {
    table.dropColumn('action_finished')
  })
}
