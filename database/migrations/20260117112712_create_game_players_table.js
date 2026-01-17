/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Drop the old players table since we are completely restructuring player identity
  await knex.schema.dropTableIfExists('players')

  return knex.schema.createTable('game_players', function (table) {
    table.increments('id').primary()
    table
      .integer('game_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('games')
      .onDelete('CASCADE')
    table
      .integer('room_player_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('room_players')
      .onDelete('CASCADE')
      
    table.integer('position').notNullable()
    table.integer('chips').notNullable().defaultTo(1000)
    table.integer('current_bet').notNullable().defaultTo(0)
    table.integer('total_bet').notNullable().defaultTo(0)
    table.json('hole_cards').nullable()
    table.enum('status', ['active', 'folded', 'all_in', 'out']).notNullable().defaultTo('active')
    table.boolean('is_dealer').notNullable().defaultTo(false)
    table.boolean('is_small_blind').notNullable().defaultTo(false)
    table.boolean('is_big_blind').notNullable().defaultTo(false)
    table.boolean('show_cards').notNullable().defaultTo(false)
    table.enum('last_action', ['fold', 'check', 'call', 'bet', 'raise', 'all_in']).nullable()
    
    table.timestamps(true, true)
    
    table.index('game_id')
    table.index('room_player_id')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  // Dropping game_players
  return knex.schema.dropTable('game_players').then(() => {
    // Recreating the old players table structure (best effort for rollback)
    return knex.schema.createTable('players', function(table) {
      table.increments('id').primary();
      table.integer('game_id').unsigned().notNullable().references('id').inTable('games').onDelete('CASCADE')
      table.string('name').notNullable();
      table.integer('position').notNullable();
      table.integer('chips').notNullable().defaultTo(1000);
      table.integer('current_bet').notNullable().defaultTo(0);
      table.json('hole_cards').nullable();
      table.enum('status', ['active', 'folded', 'all_in', 'out']).notNullable().defaultTo('active');
      table.uuid('session_token').notNullable().unique();
      table.boolean('is_dealer').notNullable().defaultTo(false);
      table.boolean('is_small_blind').notNullable().defaultTo(false);
      table.boolean('is_big_blind').notNullable().defaultTo(false);
      table.enum('last_action', ['fold', 'check', 'call', 'bet', 'raise', 'all_in']).nullable();
      table.boolean('connected').notNullable().defaultTo(true);
      table.timestamps(true, true);
      table.string('password_hash').notNullable();
      table.integer('total_bet').notNullable().defaultTo(0);
      table.boolean('show_cards').notNullable().defaultTo(false);
      
      table.index('game_id');
      table.index('session_token');
    });
  })
}
