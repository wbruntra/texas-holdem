/**
 * Migration: Add sequence_number to actions for explicit ordering
 * This ensures actions are replayed in exact order, not just timestamp
 */

exports.up = function (knex) {
  return knex.schema.alterTable('actions', function (table) {
    table
      .integer('sequence_number')
      .notNullable()
      .defaultTo(0)
      .comment('Sequence number for action ordering within a hand')
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('actions', function (table) {
    table.dropColumn('sequence_number')
  })
}
