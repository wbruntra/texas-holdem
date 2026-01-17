/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('game_events', (table) => {
      table.increments('id').primary()
      table.integer('game_id').notNullable().references('id').inTable('games').onDelete('CASCADE')
      table.integer('hand_number').notNullable().defaultTo(0)
      table.integer('sequence_number').notNullable()
      table.string('event_type').notNullable()
      table.integer('player_id')
      table.json('payload').notNullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      
      table.unique(['game_id', 'hand_number', 'sequence_number'])
    })
    .then(() => {
      return knex.schema.alterTable('game_events', (table) => {
        table.index(['game_id', 'hand_number'])
      })
    })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('game_events')
}
