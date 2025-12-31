/**
 * Check detailed action history
 */

const db = require('./db')

async function investigateActions(roomCode) {
  console.log(`\n🔍 Investigating actions in room: ${roomCode}\n`)

  try {
    const game = await db('games').where({ room_code: roomCode }).first()
    if (!game) {
      console.log('❌ Game not found')
      process.exit(0)
    }

    console.log(`═══ HAND #${game.hand_number} ACTION LOG ═══\n`)

    // Get the hand record
    const hand = await db('hands')
      .where({ game_id: game.id })
      .orderBy('hand_number', 'desc')
      .first()

    if (!hand) {
      console.log('No hand record found')
      process.exit(0)
    }

    const actions = await db('actions').where({ hand_id: hand.id }).orderBy('created_at', 'asc')

    const players = await db('players').where({ game_id: game.id })

    if (actions.length === 0) {
      console.log('No actions recorded')
      process.exit(0)
    }

    let currentRound = null
    let actionCount = 0

    actions.forEach((action, i) => {
      const player = players.find((p) => p.id === action.player_id)
      const playerName = player ? player.name : 'Unknown'

      if (action.round !== currentRound) {
        currentRound = action.round
        console.log(`\n📍 Round: ${action.round.toUpperCase()}`)
      }

      actionCount++
      const amount = action.amount > 0 ? ` $${action.amount}` : ''
      console.log(`  ${actionCount}. ${playerName}: ${action.action_type}${amount}`)
    })

    console.log(`\n═══ SUMMARY ═══`)
    console.log(`Total actions: ${actionCount}`)

    // Check last round
    const lastAction = actions[actions.length - 1]
    console.log(`Last action round: ${lastAction.round}`)
    console.log(`Last action: ${lastAction.action_type}`)

    // Check if game advanced past last action
    console.log(`\nGame last round: ${game.current_round}`)
    if (game.current_round !== lastAction.round) {
      console.log(
        `✓ Game advanced past last recorded action (from ${lastAction.round} to ${game.current_round})`,
      )
    }
  } catch (error) {
    console.error('Error:', error.message)
    console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

const roomCode = process.argv[2] || 'P8757N'
investigateActions(roomCode)
