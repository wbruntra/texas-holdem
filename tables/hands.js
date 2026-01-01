/**
 * hands Table DDL:
 * BEGIN_DDL
CREATE TABLE hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    hand_number INTEGER NOT NULL,
    dealer_position INTEGER NOT NULL,
    winners json,
    pot_amount INTEGER,
    community_cards json,
    completed_at datetime,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deck TEXT,
    player_hole_cards TEXT,
    player_stacks_start TEXT,
    player_stacks_end TEXT,
    pots TEXT,
    small_blind INTEGER,
    big_blind INTEGER,
    PRIMARY KEY (id),
    CONSTRAINT fk_hands_game_id_games_id FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Referenced by:
-- * actions.hand_id (fk_actions_hand_id_hands_id)

-- References:
-- * games via game_id (fk_hands_game_id_games_id)
 * END_DDL
 */
const { Model } = require('objection')
const knex = require('../db')

// Initialize knex connection for all models
if (!Model.knex()) {
  Model.knex(knex)
}

class Hands extends Model {
  static get tableName() {
    return 'hands'
  }

  // TODO: Add jsonSchema based on DDL above
  // TODO: Add relationMappings if needed
}

module.exports = Hands
