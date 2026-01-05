exports.up = function(knex) {
  return knex.schema
    .table('games', function(table) {
      table.text('seed').nullable().comment('Seed for deterministic card shuffling')
    })
    .table('hands', function(table) {
      table.text('seed').nullable().comment('Hand-specific seed for deterministic card shuffling')
    })
}

exports.down = function(knex) {
  return knex.schema
    .table('games', function(table) {
      table.dropColumn('seed')
    })
    .table('hands', function(table) {
      table.dropColumn('seed')
    })
}