/**
 * Remove pots column from games table.
 * Pots should be calculated on-the-fly from players.total_bet, not stored redundantly.
 */
exports.up = function (knex) {
  return knex.schema.table('games', (table) => {
    table.dropColumn('pots')
    table.dropColumn('total_bet')
  })
}

exports.down = function (knex) {
  return knex.schema.table('games', (table) => {
    table.json('pots')
    table.json('total_bet')
  })
}
