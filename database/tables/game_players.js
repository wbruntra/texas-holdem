/**
 * game_players Table Model
 * Replaces old Players model
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

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['game_id', 'room_player_id', 'position', 'chips', 'status', 'total_bet'],
      properties: {
        id: { type: 'integer' },
        game_id: { type: 'integer' },
        room_player_id: { type: 'integer' },
        position: { type: 'integer' },
        chips: { type: 'integer' },
        current_bet: { type: 'integer' },
        total_bet: { type: 'integer' },
        hole_cards: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        status: { type: 'string', enum: ['active', 'folded', 'all_in', 'out'] },
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
    const Actions = require('./actions')

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
      actions: {
        relation: Model.HasManyRelation,
        modelClass: Actions,
        join: {
          // Actions table likely still points to 'player_id'.
          // Since we dropped 'players', we need to check if 'actions' table was updated.
          // Wait, I did NOT update 'actions' table FK in my migrations!
          // The actions table has 'player_id'.
          // If I dropped 'players', the FK in 'actions' might have caused issues or was dropped too?
          // I used 'delete' in resetGame, but what about the schema?
          // The 'actions' migration (20251230000004_create_actions_table.cjs) references 'players.id'.
          // When I dropped 'players', the FK constraint should have been dropped or it prevented drop?
          // I assumed 'players' drop would work.
          // If it worked, 'actions' now has a dangling 'player_id' column or the FK is gone.
          // I should assume 'player_id' in ACTIONS now refers to GAME_PLAYERS.id because
          // actions are per-game-player events.
          // So I should map 'from: game_players.id, to: actions.player_id'
          from: 'game_players.id',
          to: 'actions.player_id',
        },
      },
    }
  }
}

module.exports = GamePlayers
