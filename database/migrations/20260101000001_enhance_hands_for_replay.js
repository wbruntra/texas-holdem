/**
 * Migration: Enhance hands table for complete hand replay
 * Adds deck, hole cards, and player stacks at start/end of hand
 */

exports.up = function (knex) {
  return knex.schema.alterTable('hands', function (table) {
    table.text('deck').comment('JSON array of full deck in order dealt')
    table.text('player_hole_cards').comment('JSON object: {player_id: [card1, card2]}')
    table.text('player_stacks_start').comment('JSON array of {player_id, position, name, chips}')
    table.text('player_stacks_end').comment('JSON array of {player_id, position, chips}')
    table.text('pots').comment('JSON array of pot breakdown with side pots')
    table.integer('small_blind').comment('Small blind amount for this hand')
    table.integer('big_blind').comment('Big blind amount for this hand')
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('hands', function (table) {
    table.dropColumn('deck')
    table.dropColumn('player_hole_cards')
    table.dropColumn('player_stacks_start')
    table.dropColumn('pots')
    table.dropColumn('player_stacks_end')
    table.dropColumn('small_blind')
    table.dropColumn('big_blind')
  })
}
