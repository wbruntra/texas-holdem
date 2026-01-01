/**
 * Detailed chip movement analysis
 */

const db = require('./db')

async function analyzeChips(roomCode) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`CHIP MOVEMENT ANALYSIS: ${roomCode}`)
  console.log(`${'='.repeat(80)}\n`)

  const game = await db('games').where({ room_code: roomCode }).first()
  const players = await db('players').where({ game_id: game.id }).orderBy('position')

  const startingChips = game.starting_chips
  const totalStarting = startingChips * players.length

  console.log(`Starting Chips per Player: ${startingChips}`)
  console.log(`Total Starting Chips: ${totalStarting}`)
  console.log(`Current Chips: ${players.reduce((sum, p) => sum + p.chips, 0)}`)
  console.log(`Difference: ${players.reduce((sum, p) => sum + p.chips, 0) - totalStarting}\n`)

  // Analyze each hand
  console.log(`${'─'.repeat(80)}`)
  console.log(`HAND-BY-HAND CHIP MOVEMENTS`)
  console.log(`${'─'.repeat(80)}\n`)

  const hands = await db('hands').where({ game_id: game.id }).orderBy('hand_number')

  let chipsByPlayer = {}
  players.forEach((p) => {
    chipsByPlayer[p.id] = startingChips
  })

  for (const hand of hands) {
    console.log(`\n📊 HAND #${hand.hand_number}`)
    console.log(`Pot Amount: ${hand.pot_amount}`)

    // Get stacks at start of hand
    let stacksStart = {}
    if (hand.player_stacks_start) {
      try {
        stacksStart = JSON.parse(hand.player_stacks_start)
      } catch (e) {
        console.log(`  ⚠️  Could not parse starting stacks`)
      }
    }

    // Get stacks at end of hand
    let stacksEnd = {}
    if (hand.player_stacks_end) {
      try {
        stacksEnd = JSON.parse(hand.player_stacks_end)
      } catch (e) {
        console.log(`  ⚠️  Could not parse ending stacks`)
      }
    }

    console.log(`  Start of hand stacks: ${JSON.stringify(stacksStart)}`)
    console.log(`  End of hand stacks: ${JSON.stringify(stacksEnd)}`)

    // Get winners
    let winners = []
    if (hand.winners) {
      try {
        winners = JSON.parse(hand.winners)
      } catch (e) {
        console.log(`  ⚠️  Invalid winners JSON`)
      }
    }

    console.log(`  Winners: ${winners.join(', ')}`)

    // Calculate chip changes
    if (Object.keys(stacksStart).length > 0 && Object.keys(stacksEnd).length > 0) {
      players.forEach((p) => {
        const pidStr = String(p.id)
        const start = stacksStart[pidStr] || 0
        const end = stacksEnd[pidStr] || 0
        const change = end - start

        if (change !== 0) {
          console.log(
            `    ${p.name} (ID: ${p.id}): ${start} → ${end} (${change > 0 ? '+' : ''}${change})`,
          )
        }
      })
    }

    // Check for issues
    if (winners.length > 1) {
      console.log(`  ⚠️  WARNING: Multiple winners (${winners.length})`)
      console.log(`      This could indicate a split pot issue or data corruption`)
    }
  }

  // Compare expected vs actual
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`FINAL VERIFICATION`)
  console.log(`${'─'.repeat(80)}\n`)

  const currentTotal = players.reduce((sum, p) => sum + p.chips, 0)
  console.log(`Expected Total Chips: ${totalStarting}`)
  console.log(`Actual Total Chips: ${currentTotal}`)
  console.log(`Difference: ${currentTotal - totalStarting}`)

  if (currentTotal !== totalStarting) {
    console.log(`\n🔴 CRITICAL: Chips not conserved! Chips created/destroyed.`)
    console.log(`   This suggests payout logic error or duplicate payout in a hand.\n`)

    // Look for the problematic hand
    console.log(`Analyzing hand #3 (most suspect due to multiple winners):`)
    const hand3 = hands.find((h) => h.hand_number === 3)
    if (hand3) {
      console.log(JSON.stringify(hand3, null, 2))
    }
  }

  console.log(`\n${'='.repeat(80)}\n`)
}

const roomCode = process.argv[2]
if (!roomCode) {
  console.error('Usage: bun analyze_chips.js <ROOM_CODE>')
  process.exit(1)
}

analyzeChips(roomCode)
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
