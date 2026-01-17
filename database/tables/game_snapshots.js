const { Model } = require('objection')
const knex = require('../db')

if (!Model.knex()) {
  Model.knex(knex)
}

class GameSnapshots extends Model {
  static get tableName() {
    return 'game_snapshots'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['game_id', 'hand_number', 'last_sequence_number', 'state'],
      properties: {
        id: { type: 'integer' },
        game_id: { type: 'integer' },
        hand_number: { type: 'integer' },
        last_sequence_number: { type: 'integer' },
        state: { type: 'object' },
        created_at: { type: 'string', format: 'date-time' },
      },
    }
  }

  static get relationMappings() {
    const Games = require('./games')

    return {
      game: {
        relation: Model.BelongsToOneRelation,
        modelClass: Games,
        join: {
          from: 'game_snapshots.game_id',
          to: 'games.id',
        },
      },
    }
  }
}

module.exports = GameSnapshots
