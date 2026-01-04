/**
 * hands Table DDL:
 * BEGIN_DDL
CREATE TABLE hands (
    id INTEGER NOT NULL,
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
-- * showdown_history.hand_id (fk_showdown_history_hand_id_hands_id)

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

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['game_id', 'hand_number', 'dealer_position'],
      properties: {
        id: { type: 'integer' },
        game_id: { type: 'integer' },
        hand_number: { type: 'integer' },
        dealer_position: { type: 'integer' },
        winners: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        pot_amount: { type: ['integer', 'null'] },
        community_cards: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
        completed_at: { type: ['string', 'null'], format: 'date-time' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        deck: { type: ['string', 'null'] },
        player_hole_cards: { type: ['string', 'null'] },
        player_stacks_start: { type: ['string', 'null'] },
        player_stacks_end: { type: ['string', 'null'] },
        pots: { type: ['string', 'null'] },
        small_blind: { type: ['integer', 'null'] },
        big_blind: { type: ['integer', 'null'] },
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
          from: 'hands.game_id',
          to: 'games.id',
        },
      },
      actions: {
        relation: Model.HasManyRelation,
        modelClass: Actions,
        join: {
          from: 'hands.id',
          to: 'actions.hand_id',
        },
      },
    }
  }
}

module.exports = Hands
