/**
 * rooms Table Model
 */
const { Model } = require('objection')
const knex = require('../db')

if (!Model.knex()) {
  Model.knex(knex)
}

class Rooms extends Model {
  static get tableName() {
    return 'rooms'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['room_code', 'status', 'small_blind', 'big_blind', 'starting_chips'],
      properties: {
        id: { type: 'integer' },
        room_code: { type: 'string', maxLength: 6 },
        status: { type: 'string' },
        small_blind: { type: 'integer' },
        big_blind: { type: 'integer' },
        starting_chips: { type: 'integer' },
        current_game_id: { type: ['integer', 'null'] },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    }
  }

  static get relationMappings() {
    const RoomPlayers = require('./room_players')
    const Games = require('./games')

    return {
      players: {
        relation: Model.HasManyRelation,
        modelClass: RoomPlayers,
        join: {
          from: 'rooms.id',
          to: 'room_players.room_id',
        },
      },
      games: {
        relation: Model.HasManyRelation,
        modelClass: Games,
        join: {
          from: 'rooms.id',
          to: 'games.room_id',
        },
      },
      currentGame: {
        relation: Model.BelongsToOneRelation,
        modelClass: Games,
        join: {
          from: 'rooms.current_game_id',
          to: 'games.id',
        },
      },
    }
  }
}

module.exports = Rooms
