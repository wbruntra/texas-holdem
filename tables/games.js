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
    PRIMARY KEY (id),
    CONSTRAINT games_room_code_unique UNIQUE (room_code)
);

-- Referenced by:
-- * hands.game_id (fk_hands_game_id_games_id)
-- * players.game_id (fk_players_game_id_games_id)

-- Note: pots are calculated on-the-fly from players.total_bet, not stored
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

  // TODO: Add jsonSchema based on DDL above
  // TODO: Add relationMappings if needed
}

module.exports = Games
