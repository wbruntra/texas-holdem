/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('game_snapshots', (table) => {
      table.increments('id').primary()
      table.integer('game_id').notNullable().references('id').inTable('games').onDelete('CASCADE')
      table.integer('hand_number').notNullable()
      table.integer('last_sequence_number').notNullable()
      table.json('state').notNullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    })
    .then(() => {
      return knex.schema.alterTable('game_snapshots', (table) => {
        table.index(['game_id', 'hand_number'])
      })
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('game_snapshots')
}
