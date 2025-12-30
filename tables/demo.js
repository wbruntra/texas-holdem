/**
 * demo Table DDL:
 * BEGIN_DDL
CREATE TABLE demo (
    id INTEGER NOT NULL,
    name varchar(255) NOT NULL,
    description varchar(255),
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
 * END_DDL
 */
const { Model } = require('objection')
const knex = require('../db')


// Initialize knex connection for all models
if (!Model.knex()) {
  Model.knex(knex)
}

class Demo extends Model {
  static get tableName() {
    return 'demo'
  }
  

  // TODO: Add jsonSchema based on DDL above
  // TODO: Add relationMappings if needed
}

module.exports = Demo
