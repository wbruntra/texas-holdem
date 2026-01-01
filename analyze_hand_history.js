/**
 * Script to analyze hand history for a game room
 * Verifies data integrity and checks if hands/actions are properly cleared on reset
 */

const db = require('./db')

async function analyzeRoom(roomCode) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Analyzing Hand History for Room: ${roomCode}`)
  console.log(`${'='.repeat(80)}\n`)

  // Get game
  const game = await db('games').where({ room_code: roomCode }).first()

  if (!game) {
    console.error(`❌ Room ${roomCode} not found!`)
    process.exit(1)
  }

  console.log(`Game ID: ${game.id}`)
  console.log(`Status: ${game.status}`)
  console.log(`Hand Number: ${game.hand_number}`)
  console.log(`Starting Chips: ${game.starting_chips}`)
  console.log(`Small Blind: ${game.small_blind}, Big Blind: ${game.big_blind}`)
  console.log(`Pot: ${game.pot}`)
  console.log(`Created: ${game.created_at}`)
  console.log(`Updated: ${game.updated_at}`)

  // Get players
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`PLAYERS`)
  console.log(`${'─'.repeat(80)}`)

  const players = await db('players').where({ game_id: game.id }).orderBy('position')

  let totalChips = 0
  players.forEach((p, idx) => {
    console.log(`\n[${idx}] ${p.name} (ID: ${p.id})`)
    console.log(`    Chips: ${p.chips}`)
    console.log(`    Current Bet: ${p.current_bet}`)
    console.log(`    Total Bet: ${p.total_bet}`)
    console.log(`    Status: ${p.status}`)
    console.log(`    Position: ${p.position}`)
    totalChips += p.chips
  })

  console.log(`\nTotal Chips in Play: ${totalChips}`)
  console.log(`Expected Total: ${game.starting_chips * players.length}`)
  const chipDifference = totalChips - game.starting_chips * players.length
  if (chipDifference !== 0) {
    console.log(`⚠️  CHIP IMBALANCE: ${chipDifference > 0 ? '+' : ''}${chipDifference} chips`)
  }

  // Get hands
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`HANDS HISTORY`)
  console.log(`${'─'.repeat(80)}`)

  const hands = await db('hands').where({ game_id: game.id }).orderBy('hand_number')

  if (hands.length === 0) {
    console.log('No hands recorded')
  } else {
    console.log(`Total Hands: ${hands.length}`)
    for (const h of hands) {
      console.log(`\nHand #${h.hand_number} (ID: ${h.id})`)
      console.log(`  Dealer Position: ${h.dealer_position}`)
      console.log(`  Small Blind: ${h.small_blind}, Big Blind: ${h.big_blind}`)
      if (h.winners) {
        try {
          const winners = JSON.parse(h.winners)
          console.log(`  Winners: ${JSON.stringify(winners)}`)
        } catch (e) {
          console.log(`  Winners: ${h.winners}`)
        }
      }
      if (h.pot_amount) {
        console.log(`  Pot Amount: ${h.pot_amount}`)
      }

      // Get actions for this hand
      const actions = await db('actions')
        .where({ hand_id: h.id })
        .leftJoin('players', 'actions.player_id', 'players.id')
        .select(
          'actions.id',
          'actions.action_type',
          'actions.amount',
          'players.name as player_name',
          'actions.player_id',
          'actions.sequence_number',
        )
        .orderBy('actions.sequence_number')

      console.log(`  Actions: ${actions.length}`)
      actions.forEach((a) => {
        console.log(
          `    [${a.action_type}] ${a.player_name} ${a.amount > 0 ? `($${a.amount})` : ''}`,
        )
      })
    }
  }

  // Get actions
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`ACTIONS SUMMARY`)
  console.log(`${'─'.repeat(80)}`)

  const allActions = await db('actions')
    .leftJoin('players', 'actions.player_id', 'players.id')
    .where('players.game_id', '=', game.id)
    .select('actions.*', 'players.name as player_name')
    .orderBy('actions.sequence_number')

  if (allActions.length === 0) {
    console.log('No actions recorded')
  } else {
    console.log(`Total Actions: ${allActions.length}`)

    // Group by hand
    const actionsByHand = {}
    allActions.forEach((a) => {
      if (!actionsByHand[a.hand_id]) {
        actionsByHand[a.hand_id] = []
      }
      actionsByHand[a.hand_id].push(a)
    })

    Object.entries(actionsByHand).forEach(([handId, handActions]) => {
      const hand = hands.find((h) => h.id === parseInt(handId))
      const handNum = hand ? hand.hand_number : '?'
      console.log(`\nHand #${handNum} (Hand ID: ${handId}): ${handActions.length} actions`)
    })
  }

  // Check for orphaned actions (actions with no hand)
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`DATA INTEGRITY CHECKS`)
  console.log(`${'─'.repeat(80)}`)

  const orphanedActions = await db('actions')
    .leftJoin('players', 'actions.player_id', 'players.id')
    .where('players.game_id', '=', game.id)
    .whereNull('actions.hand_id')
    .count('* as count')
    .first()

  if (orphanedActions.count > 0) {
    console.log(`⚠️  ${orphanedActions.count} orphaned actions (no hand_id)`)
  } else {
    console.log(`✅ No orphaned actions`)
  }

  // Check for actions with invalid player_id
  const invalidActions = await db('actions')
    .whereNotIn('player_id', db('players').select('id'))
    .count('* as count')
    .first()

  if (invalidActions.count > 0) {
    console.log(`⚠️  ${invalidActions.count} actions with invalid player_id`)
  } else {
    console.log(`✅ All actions have valid player_id`)
  }

  // Check for hands with invalid player references
  const invalidHands = await db('hands')
    .where({ game_id: game.id })
    .whereNotIn('dealer_position', db('players').where({ game_id: game.id }).select('position'))
    .count('* as count')
    .first()

  if (invalidHands.count > 0) {
    console.log(`⚠️  ${invalidHands.count} hands with invalid position references`)
  } else {
    console.log(`✅ All hands have valid position references`)
  }

  // Check for duplicate hands
  const duplicateHands = await db('hands')
    .where({ game_id: game.id })
    .groupBy('hand_number')
    .havingRaw('COUNT(*) > 1')
    .select('hand_number', db.raw('COUNT(*) as count'))

  if (duplicateHands.length > 0) {
    console.log(`⚠️  Duplicate hand numbers found:`)
    duplicateHands.forEach((dup) => {
      console.log(`    Hand #${dup.hand_number}: ${dup.count} entries`)
    })
  } else {
    console.log(`✅ No duplicate hand numbers`)
  }

  // Check if hand_number in game matches actual hands
  const maxHandData = await db('hands')
    .where({ game_id: game.id })
    .max('hand_number as max')
    .first()

  const maxHandNumber = maxHandData?.max

  if (maxHandNumber !== null && maxHandNumber !== undefined) {
    if (game.hand_number !== maxHandNumber + 1) {
      console.log(
        `⚠️  Hand number mismatch: Game says ${game.hand_number}, but max hand is ${maxHandNumber}`,
      )
    } else {
      console.log(`✅ Hand numbers are consistent`)
    }
  } else if (game.hand_number !== 0) {
    console.log(`⚠️  Hand number mismatch: Game says ${game.hand_number}, but no hands recorded`)
  } else {
    console.log(`✅ Hand numbers are consistent`)
  }

  // Detailed current state check
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`CURRENT GAME STATE`)
  console.log(`${'─'.repeat(80)}`)

  console.log(`Current Round: ${game.current_round}`)
  console.log(`Current Bet: ${game.current_bet}`)
  console.log(`Current Player Position: ${game.current_player_position}`)
  console.log(`Pot: ${game.pot}`)
  console.log(
    `Community Cards: ${game.community_cards ? JSON.stringify(JSON.parse(game.community_cards)) : 'none'}`,
  )

  if (game.pots) {
    try {
      const pots = JSON.parse(game.pots)
      console.log(`Pots: ${JSON.stringify(pots, null, 2)}`)
    } catch (e) {
      console.log(`⚠️  Invalid pots JSON: ${game.pots}`)
    }
  }

  console.log(`\n${'='.repeat(80)}\n`)
}

async function main() {
  const roomCode = process.argv[2]

  if (!roomCode) {
    // If no room code provided, show all games
    console.log('Available games:')
    const games = await db('games')
      .orderBy('created_at', 'desc')
      .limit(10)
      .select('id', 'room_code', 'status', 'hand_number')

    if (games.length === 0) {
      console.log('No games found')
      process.exit(0)
    }

    games.forEach((g) => {
      console.log(`  ${g.room_code} (ID: ${g.id}, Status: ${g.status}, Hand #${g.hand_number})`)
    })

    console.log('\nUsage: bun analyze_hand_history.js <ROOM_CODE>')
    process.exit(0)
  }

  await analyzeRoom(roomCode)
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
