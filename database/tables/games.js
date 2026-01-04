/**
 * games Table DDL:
 * BEGIN_DDL
CREATE TABLE games (
    id INTEGER NOT NULL,
    room_code varchar(6) NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    small_blind INTEGER NOT NULL DEFAULT '5',
    big_blind INTEGER NOT NULL DEFAULT '10',
    starting_chips INTEGER NOT NULL DEFAULT '1000',
    dealer_position INTEGER NOT NULL DEFAULT '0',
    current_round TEXT,
    pot INTEGER NOT NULL DEFAULT '0',
    community_cards json,
    current_bet INTEGER NOT NULL DEFAULT '0',
    current_player_position INTEGER,
    hand_number INTEGER NOT NULL DEFAULT '0',
    last_raise INTEGER NOT NULL DEFAULT '0',
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deck TEXT,
    winners TEXT,
    showdown_processed boolean NOT NULL DEFAULT '0',
    action_finished boolean NOT NULL DEFAULT '0',
    PRIMARY KEY (id),
    CONSTRAINT games_room_code_unique UNIQUE (room_code)
);

-- Referenced by:
-- * hands.game_id (fk_hands_game_id_games_id)
-- * players.game_id (fk_players_game_id_games_id)
-- * showdown_history.game_id (fk_showdown_history_game_id_games_id)
 * END_DDL
 */
const { Model } = require('objection')
const knex = require('../db')

// Initialize knex connection for all models
if (!Model.knex()) {
  Model.knex(knex)
}

class Games extends Model {
  static get tableName() {
    return 'games'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [
        'room_code',
        'status',
        'small_blind',
        'big_blind',
        'starting_chips',
        'dealer_position',
        'pot',
        'current_bet',
      ],
      properties: {
        id: { type: 'integer' },
        room_code: { type: 'string', maxLength: 6 },
        status: { type: 'string' },
        small_blind: { type: 'integer' },
        big_blind: { type: 'integer' },
        starting_chips: { type: 'integer' },
        dealer_position: { type: 'integer' },
        current_round: { type: ['string', 'null'] },
        pot: { type: 'integer' },
        community_cards: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        current_bet: { type: 'integer' },
        current_player_position: { type: ['integer', 'null'] },
        hand_number: { type: 'integer' },
        last_raise: { type: 'integer' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        deck: { type: ['string', 'null'] },
        winners: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        action_finished: { type: 'boolean' },
      },
    }
  }

  static get relationMappings() {
    const Players = require('./players')
    const Hands = require('./hands')

    return {
      players: {
        relation: Model.HasManyRelation,
        modelClass: Players,
        join: {
          from: 'games.id',
          to: 'players.game_id',
        },
      },
      hands: {
        relation: Model.HasManyRelation,
        modelClass: Hands,
        join: {
          from: 'games.id',
          to: 'hands.game_id',
        },
      },
    }
  }
}

module.exports = Games
