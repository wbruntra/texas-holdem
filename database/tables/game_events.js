const { Model } = require('objection')
const knex = require('../db')

if (!Model.knex()) {
  Model.knex(knex)
}

class GameEvents extends Model {
  static get tableName() {
    return 'game_events'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['game_id', 'hand_number', 'sequence_number', 'event_type', 'payload'],
      properties: {
        id: { type: 'integer' },
        game_id: { type: 'integer' },
        hand_number: { type: 'integer' },
        sequence_number: { type: 'integer' },
        event_type: { type: 'string' },
        player_id: { type: ['integer', 'null'] },
        payload: { type: 'object' },
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
          from: 'game_events.game_id',
          to: 'games.id',
        },
      },
    }
  }
}

module.exports = GameEvents
