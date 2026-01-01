
exports.up = function(knex) {
  return knex.schema.table('players', function(table) {
    table.boolean('show_cards').notNullable().defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('players', function(table) {
    table.dropColumn('show_cards');
  });
};
