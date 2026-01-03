/**
 * players Table DDL:
 * BEGIN_DDL
CREATE TABLE players (
    id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    name varchar(255) NOT NULL,
    position INTEGER NOT NULL,
    chips INTEGER NOT NULL DEFAULT '1000',
    current_bet INTEGER NOT NULL DEFAULT '0',
    hole_cards json,
    status TEXT NOT NULL DEFAULT 'active',
    is_dealer boolean NOT NULL DEFAULT '0',
    is_small_blind boolean NOT NULL DEFAULT '0',
    is_big_blind boolean NOT NULL DEFAULT '0',
    last_action TEXT,
    connected boolean NOT NULL DEFAULT '1',
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    password_hash varchar(255) NOT NULL,
    total_bet INTEGER NOT NULL DEFAULT '0',
    show_cards boolean NOT NULL DEFAULT '0',
    PRIMARY KEY (id),
    CONSTRAINT fk_players_game_id_games_id FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Referenced by:
-- * actions.player_id (fk_actions_player_id_players_id)

-- References:
-- * games via game_id (fk_players_game_id_games_id)
 * END_DDL
 */
const { Model } = require('objection')
const knex = require('../db')

// Initialize knex connection for all models
if (!Model.knex()) {
  Model.knex(knex)
}

class Players extends Model {
  static get tableName() {
    return 'players'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'game_id',
        'name',
        'position',
        'chips',
        'status',
        'is_dealer',
        'is_small_blind',
        'is_big_blind',
        'connected',
        'password_hash',
        'total_bet',
      ],
      properties: {
        id: { type: 'integer' },
        game_id: { type: 'integer' },
        name: { type: 'string', maxLength: 255 },
        position: { type: 'integer' },
        chips: { type: 'integer' },
        current_bet: { type: 'integer' },
        hole_cards: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        status: { type: 'string' },
        is_dealer: { type: 'boolean' },
        is_small_blind: { type: 'boolean' },
        is_big_blind: { type: 'boolean' },
        last_action: { type: ['string', 'null'] },
        connected: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        password_hash: { type: 'string', maxLength: 255 },
        total_bet: { type: 'integer' },
        show_cards: { type: 'boolean' },
      },
    }
  }

  static get relationMappings() {
    const Games = require('./games')
    const Actions = require('./actions')

    return {
      game: {
        relation: Model.BelongsToOneRelation,
        modelClass: Games,
        join: {
          from: 'players.game_id',
          to: 'games.id',
        },
      },
      actions: {
        relation: Model.HasManyRelation,
        modelClass: Actions,
        join: {
          from: 'players.id',
          to: 'actions.player_id',
        },
      },
    }
  }
}

module.exports = Players
