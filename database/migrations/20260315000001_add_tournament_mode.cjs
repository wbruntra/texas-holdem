exports.up = function (knex) {
  return knex.schema
    .table('rooms', function (table) {
      table.boolean('tournament_mode').defaultTo(false)
      table.integer('hands_per_blind_level').defaultTo(20)
    })
    .then(() =>
      knex.schema.table('games', function (table) {
        table.boolean('tournament_mode').defaultTo(false)
        table.integer('hands_per_blind_level').defaultTo(20)
        table.integer('initial_small_blind').nullable()
        table.integer('initial_big_blind').nullable()
      }),
    )
}

exports.down = function (knex) {
  return knex.schema
    .table('rooms', function (table) {
      table.dropColumn('tournament_mode')
      table.dropColumn('hands_per_blind_level')
    })
    .then(() =>
      knex.schema.table('games', function (table) {
        table.dropColumn('tournament_mode')
        table.dropColumn('hands_per_blind_level')
        table.dropColumn('initial_small_blind')
        table.dropColumn('initial_big_blind')
      }),
    )
}
