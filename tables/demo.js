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

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', maxLength: 255 },
        description: { type: ['string', 'null'], maxLength: 255 },
        created_at: { type: ['string', 'null'], format: 'date-time' },
        updated_at: { type: ['string', 'null'], format: 'date-time' },
      },
    }
  }
}

module.exports = Demo
