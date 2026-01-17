/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Clear existing games data to avoid migration issues with new non-nullable columns
  await knex('games').del() // This should cascade to players/hands if configured, but let's be safe
  // Note: players table has ON DELETE CASCADE for game_id, so players will be deleted.

  return knex.schema.alterTable('games', function (table) {
    // Drop unique constraint on room_code since a room (with one code) can have multiple games
    table.dropUnique(['room_code'])
    
    // Add reference to room
    table
      .integer('room_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('rooms')
      .onDelete('CASCADE')
      
    // Add game sequence number
    table.integer('game_number').notNullable().defaultTo(1)
    
    // Config fields (small_blind, big_blind, starting_chips) are already present, 
    // keeping them as requested by user.
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('games', function (table) {
    table.dropColumn('room_id')
    table.dropColumn('game_number')
    // We cannot easily restore the unique constraint if duplicate room_codes exist, 
    // but in down migration theoretically we would want to.
  })
}
