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
    seed TEXT,
    room_id INTEGER NOT NULL,
    game_number INTEGER NOT NULL DEFAULT '1',
    PRIMARY KEY (id),
    CONSTRAINT fk_games_room_id_rooms_id FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- Referenced by:
-- * hands.game_id (fk_hands_game_id_games_id)
-- * showdown_history.game_id (fk_showdown_history_game_id_games_id)
-- * game_events.game_id (fk_game_events_game_id_games_id)
-- * game_snapshots.game_id (fk_game_snapshots_game_id_games_id)
-- * game_players.game_id (fk_game_players_game_id_games_id)

-- References:
-- * rooms via room_id (fk_games_room_id_rooms_id)
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
        'room_id',
        'game_number',
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
        room_id: { type: 'integer' },
        game_number: { type: 'integer' },
        room_code: { type: ['string', 'null'] }, // Optional now
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
    const GamePlayers = require('./game_players')
    const Hands = require('./hands')
    const Rooms = require('./rooms')

    return {
      players: {
        relation: Model.HasManyRelation,
        modelClass: GamePlayers,
        join: {
          from: 'games.id',
          to: 'game_players.game_id',
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
      room: {
        relation: Model.BelongsToOneRelation,
        modelClass: Rooms,
        join: {
          from: 'games.room_id',
          to: 'rooms.id',
        },
      },
    }
  }
}

module.exports = Games
