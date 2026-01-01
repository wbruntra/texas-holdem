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

  // TODO: Add jsonSchema based on DDL above
  // TODO: Add relationMappings if needed
}

module.exports = Players
