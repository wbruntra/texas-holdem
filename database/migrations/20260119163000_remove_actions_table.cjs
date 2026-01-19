
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.dropTable('actions');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.createTable('actions', function(table) {
    table.increments('id').primary();
    table.integer('hand_id').unsigned().references('id').inTable('hands');
    table.integer('player_id').unsigned();
    table.string('action_type');
    table.integer('amount');
    table.string('round');
    table.integer('sequence_number');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};
