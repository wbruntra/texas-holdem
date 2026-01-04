/**
 * showdown_history Table DDL:
 * BEGIN_DDL
CREATE TABLE showdown_history (
    id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    hand_id INTEGER NOT NULL,
    hand_number INTEGER NOT NULL,
    community_cards json,
    player_info json,
    pot_breakdown json,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_showdown_history_hand_id_hands_id FOREIGN KEY (hand_id) REFERENCES hands(id),
    CONSTRAINT fk_showdown_history_game_id_games_id FOREIGN KEY (game_id) REFERENCES games(id)
);

-- References:
-- * hands via hand_id (fk_showdown_history_hand_id_hands_id)
-- * games via game_id (fk_showdown_history_game_id_games_id)
 * END_DDL
 */
const { Model } = require('objection')
const knex = require('../db')

// Initialize knex connection for all models
if (!Model.knex()) {
  Model.knex(knex)
}

class ShowdownHistory extends Model {
  static get tableName() {
    return 'showdown_history'
  }

  // TODO: Add jsonSchema based on DDL above
  // TODO: Add relationMappings if needed
}

module.exports = ShowdownHistory
