/**
 * actions Table DDL:
 * BEGIN_DDL
CREATE TABLE actions (
    id INTEGER NOT NULL,
    hand_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT '0',
    round TEXT NOT NULL,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sequence_number INTEGER NOT NULL DEFAULT '0',
    PRIMARY KEY (id),
    CONSTRAINT fk_actions_player_id_players_id FOREIGN KEY (player_id) REFERENCES players(id),
    CONSTRAINT fk_actions_hand_id_hands_id FOREIGN KEY (hand_id) REFERENCES hands(id)
);

-- References:
-- * players via player_id (fk_actions_player_id_players_id)
-- * hands via hand_id (fk_actions_hand_id_hands_id)
 * END_DDL
 */
const { Model } = require('objection')
const knex = require('../db')

// Initialize knex connection for all models
if (!Model.knex()) {
  Model.knex(knex)
}

class Actions extends Model {
  static get tableName() {
    return 'actions'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['hand_id', 'player_id', 'action_type', 'amount', 'round'],
      properties: {
        id: { type: 'integer' },
        hand_id: { type: 'integer' },
        player_id: { type: 'integer' },
        action_type: { type: 'string' },
        amount: { type: 'integer' },
        round: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: ['string', 'null'], format: 'date-time' },
        sequence_number: { type: 'integer' },
      },
    }
  }

  static get relationMappings() {
    const Players = require('./players')
    const Hands = require('./hands')

    return {
      player: {
        relation: Model.BelongsToOneRelation,
        modelClass: Players,
        join: {
          from: 'actions.player_id',
          to: 'players.id',
        },
      },
      hand: {
        relation: Model.BelongsToOneRelation,
        modelClass: Hands,
        join: {
          from: 'actions.hand_id',
          to: 'hands.id',
        },
      },
    }
  }
}

module.exports = Actions
