/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('room_players', function (table) {
    table.increments('id').primary()
    table
      .integer('room_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('rooms')
      .onDelete('CASCADE')
    table.string('name').notNullable()
    table.uuid('session_token').notNullable().unique()
    table.string('password_hash').notNullable() // For rejoining
    table.boolean('connected').notNullable().defaultTo(true)
    table.integer('chips').notNullable().defaultTo(1000) // Chips carried across games
    table.timestamps(true, true)

    table.unique(['room_id', 'name']) // Unique name per room
    table.index('room_id')
    table.index('session_token')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('room_players')
}
