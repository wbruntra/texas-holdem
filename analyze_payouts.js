/**
 * Detailed payout analysis
 */

const db = require('./db')
const { distributePots } = require('./backend/lib/pot-manager')

async function analyzePayouts(roomCode) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`PAYOUT ANALYSIS: ${roomCode}`)
  console.log(`${'='.repeat(80)}\n`)

  const game = await db('games').where({ room_code: roomCode }).first()
  const hands = await db('hands').where({ game_id: game.id }).orderBy('hand_number')

  for (const hand of hands) {
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`HAND #${hand.hand_number}`)
    console.log(`${'─'.repeat(80)}`)

    // Get actions for this hand
    const actions = await db('actions')
      .where({ hand_id: hand.id })
      .leftJoin('players', 'actions.player_id', 'players.id')
      .select('actions.*', 'players.name as player_name', 'players.position')
      .orderBy('actions.sequence_number')

    // Parse stacks
    let stacksStart = {}
    let stacksEnd = {}
    let pots = []
    let winners = []

    try {
      stacksStart = JSON.parse(hand.player_stacks_start)
      stacksEnd = JSON.parse(hand.player_stacks_end)
      pots = JSON.parse(hand.pots)
      winners = JSON.parse(hand.winners)
    } catch (e) {
      console.log(`❌ Error parsing hand data: ${e.message}`)
      continue
    }

    // Show action sequence
    console.log(`\nACTION SEQUENCE:`)
    let currentRound = null
    actions.forEach((a, idx) => {
      if (a.round !== currentRound) {
        currentRound = a.round
        console.log(`  [${currentRound.toUpperCase()}]`)
      }
      console.log(
        `    ${idx + 1}. ${a.player_name} (pos ${a.position}): ${a.action_type} ${a.amount > 0 ? `($${a.amount})` : ''}`,
      )
    })

    if (actions.length === 0) {
      console.log(`  (no actions recorded)`)
    }

    // Calculate totals
    const stackStartTotal = stacksStart.reduce((sum, s) => sum + s.chips, 0)
    const stackEndTotal = stacksEnd.reduce((sum, s) => sum + s.chips, 0)
    const potsTotal = pots.reduce((sum, p) => sum + p.amount, 0)

    console.log(`\nSTACKS AT START:`)
    stacksStart.forEach((s) => {
      console.log(`  ${s.name}: ${s.chips}`)
    })
    console.log(`  Total: ${stackStartTotal}`)

    console.log(`\nPOTS STRUCTURE:`)
    pots.forEach((p, idx) => {
      console.log(`  Pot ${idx}: ${p.amount} chips`)
      console.log(`    Eligible: [${p.eligiblePlayers.join(', ')}]`)
      console.log(`    Winners: [${p.winners.join(', ')}]`)
      if (p.winAmount) {
        console.log(`    Win Amount: ${p.winAmount}`)
      }
    })
    console.log(`  Total Pots: ${potsTotal}`)

    console.log(`\nWINNERS: [${winners.join(', ')}]`)

    console.log(`\nSTACKS AT END:`)
    stacksEnd.forEach((s) => {
      console.log(`  Player ${s.player_id}: ${s.chips}`)
    })
    console.log(`  Total: ${stackEndTotal}`)

    console.log(`\nVERIFICATION:`)
    const chipDiff = stackEndTotal - stackStartTotal
    console.log(`  Chips before: ${stackStartTotal}`)
    console.log(`  Chips after: ${stackEndTotal}`)
    console.log(`  Difference: ${chipDiff}`)

    if (chipDiff > 0) {
      console.log(`  🔴 CHIPS CREATED: +${chipDiff}`)
    } else if (chipDiff < 0) {
      console.log(`  🔴 CHIPS DESTROYED: ${chipDiff}`)
    } else {
      console.log(`  ✅ Chips conserved`)
    }

    // Check if payout distribution matches actual chip changes
    console.log(`\nCHIP CHANGE BY PLAYER:`)
    const stackStartMap = {}
    const stackEndMap = {}
    stacksStart.forEach((s) => {
      stackStartMap[s.player_id] = s.chips
    })
    stacksEnd.forEach((s) => {
      stackEndMap[s.player_id] = s.chips
    })

    const players = await db('players').where({ game_id: game.id })
    players.forEach((p) => {
      const startChips = stackStartMap[p.id] || 0
      const endChips = stackEndMap[p.id] || 0
      const change = endChips - startChips

      if (change !== 0) {
        console.log(
          `  Player ${p.id} (${p.name}): ${startChips} → ${endChips} (${change > 0 ? '+' : ''}${change})`,
        )
      }
    })

    // Verify payout logic
    console.log(`\nPAYOUT VERIFICATION:`)
    const payoutsByPlayer = {}
    pots.forEach((pot, potIdx) => {
      if (pot.winners && pot.winners.length > 0) {
        // For multi-way pots, each winner gets equal share
        const wagerPerWinner = pot.amount / pot.winners.length
        pot.winners.forEach((winner) => {
          if (!payoutsByPlayer[winner]) {
            payoutsByPlayer[winner] = 0
          }
          payoutsByPlayer[winner] += wagerPerWinner
        })
      }
    })

    console.log(`  Expected payouts:`)
    Object.entries(payoutsByPlayer).forEach(([playerId, payout]) => {
      console.log(`    Player ${playerId}: ${payout}`)
    })

    // For single-winner hands, check if payout matches pot
    if (winners.length === 1) {
      const totalWinnings = pots.reduce((sum, p) => {
        if (p.winners.includes(winners[0])) {
          return sum + p.amount
        }
        return sum
      }, 0)
      console.log(`  Total pot for winner: ${totalWinnings}`)
    } else if (winners.length > 1) {
      console.log(`  ⚠️  Multiple winners - check for split pot issues`)
    }
  }

  console.log(`\n${'='.repeat(80)}\n`)
}

const roomCode = process.argv[2]
if (!roomCode) {
  console.error('Usage: bun analyze_payouts.js <ROOM_CODE>')
  process.exit(1)
}

analyzePayouts(roomCode)
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
