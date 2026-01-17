/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('rooms', function (table) {
    table.increments('id').primary()
    table.string('room_code', 6).notNullable().unique()
    table.enum('status', ['waiting', 'active', 'closed']).notNullable().defaultTo('waiting')
    table.integer('small_blind').notNullable().defaultTo(5)
    table.integer('big_blind').notNullable().defaultTo(10)
    table.integer('starting_chips').notNullable().defaultTo(1000)
    table.integer('current_game_id').nullable() // FK added later to avoid circular dependency if needed, or just integer
    table.timestamps(true, true)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('rooms')
}
