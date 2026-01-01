const db = require('./db')

const roomCode = process.argv[2] || 'GDJQVJ'

;(async () => {
  try {
    // Find the game
    const game = await db('games').where('room_code', roomCode).first()
    if (!game) {
      console.log('Game not found')
      process.exit(1)
    }

    console.log('=== GAME STATE ===')
    console.log('ID:', game.id)
    console.log('Status:', game.status)
    console.log('Current Round:', game.current_round)
    console.log('Current Player Position:', game.current_player_position)
    console.log('Current Bet:', game.current_bet)
    console.log('Pot:', game.pot)
    console.log('Pots:', game.pots)
    console.log('Community Cards:', game.community_cards)
    console.log('')

    // Get players
    const players = await db('players').where('game_id', game.id).orderBy('position')
    console.log('=== PLAYERS ===')
    players.forEach((p) => {
      console.log(`P${p.position} (${p.name}):`)
      console.log(`  Chips: ${p.chips}`)
      console.log(`  Status: ${p.status}`)
      console.log(`  Current Bet: ${p.current_bet}`)
      console.log(`  Total Bet: ${p.total_bet}`)
      console.log(`  Last Action: ${p.last_action}`)
      console.log(`  Hole Cards: ${p.hole_cards}`)
    })
    console.log('')

    // Get current hand
    const hands = await db('hands').where('game_id', game.id).orderBy('hand_number', 'desc')

    console.log('=== HANDS ===')
    console.log(`Total hands: ${hands.length}`)
    if (hands.length > 0) {
      const currentHand = hands[0]
      console.log(`Current hand #${currentHand.hand_number}:`)
      console.log(`  ID: ${currentHand.id}`)
      console.log(`  Dealer Position: ${currentHand.dealer_position}`)
      console.log('')

      // Get actions for current hand
      const actions = await db('actions').where('hand_id', currentHand.id).orderBy('created_at')

      console.log('=== ACTIONS (current hand) ===')
      for (const action of actions) {
        const player = players.find((p) => p.id === action.player_id)
        console.log(
          `[${action.created_at}] P${player.position} (${player.name}) - ${action.action_type} ${action.amount > 0 ? '$' + action.amount : ''} (round: ${action.round})`,
        )
      }
    }

    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
})()
