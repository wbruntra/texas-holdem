/**
 * actions Table DDL:
 * BEGIN_DDL
CREATE TABLE actions (
    id char(36) DEFAULT lower(hex(randomblob(16))),
    hand_id char(36) NOT NULL,
    player_id char(36) NOT NULL,
    action_type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT '0',
    round TEXT NOT NULL,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_actions_player_id_players_id FOREIGN KEY (player_id) REFERENCES players(id),
    CONSTRAINT fk_actions_hand_id_hands_id FOREIGN KEY (hand_id) REFERENCES hands(id)
);

-- References:
-- * players via player_id (fk_actions_player_id_players_id)
-- * hands via hand_id (fk_actions_hand_id_hands_id)
 * END_DDL
 */
const { Model } = require('objection');
const knex = require('../db');

// Initialize knex connection for all models
if (!Model.knex()) {
  Model.knex(knex);
}

class Actions extends Model {
  static get tableName() {
    return 'actions';
  }

  // TODO: Add jsonSchema based on DDL above
  // TODO: Add relationMappings if needed
}

module.exports = Actions;
