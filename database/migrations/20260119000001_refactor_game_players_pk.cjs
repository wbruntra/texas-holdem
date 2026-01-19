/**
 * Refactor game_players to use composite primary key (room_player_id, game_id)
 * instead of separate id column. This makes player identity consistent across games.
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Step 1: Create new game_players table with composite key
  await knex.schema.createTable('game_players_new', (table) => {
    table.integer('room_player_id').notNullable()
    table.integer('game_id').notNullable()
    table.integer('position').notNullable()
    table.integer('chips').notNullable().defaultTo(0)
    table.integer('current_bet').notNullable().defaultTo(0)
    table.integer('total_bet').notNullable().defaultTo(0)
    table.json('hole_cards').nullable()
    table
      .string('status')
      .notNullable()
      .defaultTo('active')
      .checkIn(['active', 'folded', 'all_in', 'out', 'sitting_out'])
    table.boolean('is_dealer').notNullable().defaultTo(false)
    table.boolean('is_small_blind').notNullable().defaultTo(false)
    table.boolean('is_big_blind').notNullable().defaultTo(false)
    table.boolean('show_cards').notNullable().defaultTo(false)
    table.string('last_action').nullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

    // Composite primary key
    table.primary(['room_player_id', 'game_id'])

    // Foreign keys
    table.foreign('room_player_id').references('id').inTable('room_players').onDelete('CASCADE')
    table.foreign('game_id').references('id').inTable('games').onDelete('CASCADE')
  })

  // Step 2: Copy data from old table
  await knex.raw(`
    INSERT INTO game_players_new 
      (room_player_id, game_id, position, chips, current_bet, total_bet, hole_cards, 
       status, is_dealer, is_small_blind, is_big_blind, show_cards, last_action, 
       created_at, updated_at)
    SELECT 
      room_player_id, game_id, position, chips, current_bet, total_bet, hole_cards,
      status, is_dealer, is_small_blind, is_big_blind, show_cards, last_action,
      created_at, updated_at
    FROM game_players
  `)

  // Step 3: Update game_events to use room_player_id
  // First, update existing records by joining to get room_player_id
  await knex.raw(`
    UPDATE game_events
    SET player_id = (
      SELECT room_player_id 
      FROM game_players 
      WHERE game_players.id = game_events.player_id
        AND game_players.game_id = game_events.game_id
    )
    WHERE player_id IS NOT NULL
  `)

  // Step 4: Drop old table and rename new one
  await knex.schema.dropTableIfExists('game_players')
  await knex.schema.renameTable('game_players_new', 'game_players')

  // Step 5: Add index on game_id for lookups
  await knex.schema.alterTable('game_players', (table) => {
    table.index('game_id')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Create old table structure
  await knex.schema.createTable('game_players_old', (table) => {
    table.increments('id').primary()
    table.integer('game_id').notNullable()
    table.integer('room_player_id').notNullable()
    table.integer('position').notNullable()
    table.integer('chips').notNullable().defaultTo(0)
    table.integer('current_bet').notNullable().defaultTo(0)
    table.integer('total_bet').notNullable().defaultTo(0)
    table.json('hole_cards').nullable()
    table
      .string('status')
      .notNullable()
      .defaultTo('active')
      .checkIn(['active', 'folded', 'all_in', 'out', 'sitting_out'])
    table.boolean('is_dealer').notNullable().defaultTo(false)
    table.boolean('is_small_blind').notNullable().defaultTo(false)
    table.boolean('is_big_blind').notNullable().defaultTo(false)
    table.boolean('show_cards').notNullable().defaultTo(false)
    table.string('last_action').nullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

    table.foreign('game_id').references('id').inTable('games').onDelete('CASCADE')
    table.foreign('room_player_id').references('id').inTable('room_players').onDelete('CASCADE')
  })

  // Copy data back (will auto-generate new IDs)
  await knex.raw(`
    INSERT INTO game_players_old 
      (game_id, room_player_id, position, chips, current_bet, total_bet, hole_cards,
       status, is_dealer, is_small_blind, is_big_blind, show_cards, last_action,
       created_at, updated_at)
    SELECT 
      game_id, room_player_id, position, chips, current_bet, total_bet, hole_cards,
      status, is_dealer, is_small_blind, is_big_blind, show_cards, last_action,
      created_at, updated_at
    FROM game_players
  `)

  // Rollback game_events (this will lose the player_id mapping since we can't recover the old IDs)
  await knex('game_events').update({ player_id: null })

  await knex.schema.dropTableIfExists('game_players')
  await knex.schema.renameTable('game_players_old', 'game_players')
}
