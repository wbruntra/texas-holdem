/**
 * room_players Table Model
 */
const { Model } = require('objection')
const knex = require('../db')

if (!Model.knex()) {
  Model.knex(knex)
}

class RoomPlayers extends Model {
  static get tableName() {
    return 'room_players'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['room_id', 'name', 'session_token', 'password_hash'],
      properties: {
        id: { type: 'integer' },
        room_id: { type: 'integer' },
        name: { type: 'string' },
        session_token: { type: 'string' },
        password_hash: { type: 'string' },
        connected: { type: 'boolean' },
        chips: { type: 'integer' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    }
  }

  static get relationMappings() {
    const Rooms = require('./rooms')
    const GamePlayers = require('./game_players')

    return {
      room: {
        relation: Model.BelongsToOneRelation,
        modelClass: Rooms,
        join: {
          from: 'room_players.room_id',
          to: 'rooms.id',
        },
      },
      participations: {
        relation: Model.HasManyRelation,
        modelClass: GamePlayers,
        join: {
          from: 'room_players.id',
          to: 'game_players.room_player_id',
        },
      },
    }
  }
}

module.exports = RoomPlayers
