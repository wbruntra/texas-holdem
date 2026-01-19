/**
 * game_players Table Model
 * Uses composite primary key (room_player_id, game_id)
 */
const { Model } = require('objection')
const knex = require('../db')

if (!Model.knex()) {
  Model.knex(knex)
}

class GamePlayers extends Model {
  static get tableName() {
    return 'game_players'
  }

  static get idColumn() {
    return ['room_player_id', 'game_id']
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['game_id', 'room_player_id', 'position', 'chips', 'status', 'total_bet'],
      properties: {
        room_player_id: { type: 'integer' },
        game_id: { type: 'integer' },
        position: { type: 'integer' },
        chips: { type: 'integer' },
        current_bet: { type: 'integer' },
        total_bet: { type: 'integer' },
        hole_cards: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        status: {
          type: 'string',
          enum: ['active', 'folded', 'all_in', 'out', 'sitting_out'],
        },
        is_dealer: { type: 'boolean' },
        is_small_blind: { type: 'boolean' },
        is_big_blind: { type: 'boolean' },
        show_cards: { type: 'boolean' },
        last_action: { type: ['string', 'null'] },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    }
  }

  static get relationMappings() {
    const Games = require('./games')
    const RoomPlayers = require('./room_players')

    return {
      game: {
        relation: Model.BelongsToOneRelation,
        modelClass: Games,
        join: {
          from: 'game_players.game_id',
          to: 'games.id',
        },
      },
      roomPlayer: {
        relation: Model.BelongsToOneRelation,
        modelClass: RoomPlayers,
        join: {
          from: 'game_players.room_player_id',
          to: 'room_players.id',
        },
      },
    }
  }
}

module.exports = GamePlayers
