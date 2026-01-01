#!/usr/bin/env node
/**
 * Hand Replay Utility
 *
 * Replays poker hands from the database, showing the complete action sequence,
 * community cards, player hands, and results.
 *
 * Usage:
 *   node replay_hand.js --room YGPN4P              # Replay all hands in a game
 *   node replay_hand.js --room YGPN4P --hand 2     # Replay specific hand
 *   node replay_hand.js --hand-id 6                # Replay by hand ID
 */

const db = require('./db')

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

// Card suit symbols
const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const suitColors = {
  hearts: colors.red,
  diamonds: colors.red,
  clubs: colors.white,
  spades: colors.white,
}

function formatCard(card) {
  const suitSymbol = suitSymbols[card.suit] || card.suit
  const suitColor = suitColors[card.suit] || colors.white
  return `${colors.bright}${card.rank}${suitColor}${suitSymbol}${colors.reset}`
}

function formatCards(cards) {
  if (!cards || cards.length === 0) return '[]'
  return '[' + cards.map(formatCard).join(' ') + ']'
}

function formatChips(amount) {
  return `${colors.yellow}$${amount}${colors.reset}`
}

function formatPlayerName(name, position) {
  return `${colors.cyan}${name}${colors.reset} (P${position})`
}

function formatActionType(actionType) {
  const colorMap = {
    fold: colors.dim,
    check: colors.white,
    call: colors.green,
    bet: colors.yellow,
    raise: colors.red,
    all_in: colors.bgRed,
  }
  const color = colorMap[actionType] || colors.white
  return `${color}${colors.bright}${actionType.toUpperCase()}${colors.reset}`
}

function formatRound(round) {
  const roundNames = {
    preflop: 'PRE-FLOP',
    flop: 'FLOP',
    turn: 'TURN',
    river: 'RIVER',
  }
  return `${colors.bgBlue}${colors.white} ${roundNames[round] || round.toUpperCase()} ${colors.reset}`
}

function printSeparator(char = '=', length = 80) {
  console.log(colors.dim + char.repeat(length) + colors.reset)
}

function printHeader(text) {
  console.log('\n' + colors.bright + colors.blue + text + colors.reset)
  printSeparator()
}

async function replayHand(handId) {
  // Get hand details
  const hand = await db('hands').where('id', handId).first()

  if (!hand) {
    console.error(`${colors.red}Hand not found with ID: ${handId}${colors.reset}`)
    return
  }

  // Get game details
  const game = await db('games').where('id', hand.game_id).first()

  // Parse JSON fields
  const communityCards = JSON.parse(hand.community_cards || '[]')
  const playerHoleCards = JSON.parse(hand.player_hole_cards || '{}')
  const playerStacksStart = JSON.parse(hand.player_stacks_start || '[]')
  const playerStacksEnd = JSON.parse(hand.player_stacks_end || '[]')
  const pots = JSON.parse(hand.pots || '[]')
  const winners = JSON.parse(hand.winners || '[]')

  // Get actions
  const actions = await db('actions')
    .where('hand_id', handId)
    .orderBy('sequence_number')
    .orderBy('created_at')

  // Print header
  printHeader(`♠ ♥ ♣ ♦  HAND REPLAY - Game ${game.room_code} - Hand #${hand.hand_number}  ♦ ♣ ♥ ♠`)

  // Print game info
  console.log(`${colors.dim}Game ID:${colors.reset} ${game.id}`)
  console.log(
    `${colors.dim}Room Code:${colors.reset} ${colors.bright}${game.room_code}${colors.reset}`,
  )
  console.log(
    `${colors.dim}Blinds:${colors.reset} ${formatChips(hand.small_blind)}/${formatChips(hand.big_blind)}`,
  )
  console.log(`${colors.dim}Dealer Position:${colors.reset} ${hand.dealer_position}`)
  console.log()

  // Print starting stacks
  printHeader('Starting Stacks')
  for (const player of playerStacksStart) {
    console.log(
      `  ${formatPlayerName(player.name, player.position)}: ${formatChips(player.chips)}`,
    )
  }
  console.log()

  // Print hole cards
  printHeader('Hole Cards')
  for (const player of playerStacksStart) {
    const cards = playerHoleCards[player.player_id] || []
    console.log(`  ${formatPlayerName(player.name, player.position)}: ${formatCards(cards)}`)
  }
  console.log()

  // Print actions grouped by round
  printHeader('Action Sequence')

  let currentRound = null
  let roundPot = 0

  for (const action of actions) {
    // Print round header when round changes
    if (action.round !== currentRound) {
      if (currentRound !== null) {
        console.log()
      }

      console.log(formatRound(action.round))

      // Show community cards for flop, turn, river
      if (action.round === 'flop' && communityCards.length >= 3) {
        console.log(
          `  ${colors.dim}Board:${colors.reset} ${formatCards(communityCards.slice(0, 3))}`,
        )
      } else if (action.round === 'turn' && communityCards.length >= 4) {
        console.log(
          `  ${colors.dim}Board:${colors.reset} ${formatCards(communityCards.slice(0, 4))}`,
        )
      } else if (action.round === 'river' && communityCards.length >= 5) {
        console.log(`  ${colors.dim}Board:${colors.reset} ${formatCards(communityCards)}`)
      }

      currentRound = action.round
    }

    // Get player info
    const player = playerStacksStart.find((p) => p.player_id === action.player_id)
    const playerName = player
      ? formatPlayerName(player.name, player.position)
      : `P${action.player_id}`

    // Format action
    let actionStr = `  ${playerName}: ${formatActionType(action.action_type)}`
    if (action.amount > 0) {
      actionStr += ` ${formatChips(action.amount)}`
      roundPot += action.amount
    }

    console.log(actionStr)
  }

  console.log()

  // Print final board
  printHeader('Showdown')
  console.log(`  ${colors.dim}Final Board:${colors.reset} ${formatCards(communityCards)}`)
  console.log()

  // Print hole cards reveal
  for (const player of playerStacksStart) {
    const cards = playerHoleCards[player.player_id] || []
    console.log(`  ${formatPlayerName(player.name, player.position)}: ${formatCards(cards)}`)
  }
  console.log()

  // Print pots and winners
  printHeader('Results')

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i]
    const potLabel = pots.length > 1 ? `Pot ${i + 1}` : 'Main Pot'

    console.log(`  ${colors.bright}${potLabel}:${colors.reset} ${formatChips(pot.amount)}`)

    if (pot.winners && pot.winners.length > 0) {
      for (const winnerPos of pot.winners) {
        const winner = playerStacksStart.find((p) => p.position === winnerPos)
        const winnerName = winner ? winner.name : `P${winnerPos}`
        const winAmount = pot.winAmount || pot.amount

        console.log(
          `    ${colors.green}${colors.bright}WINNER:${colors.reset} ` +
            `${formatPlayerName(winnerName, winnerPos)} wins ${formatChips(winAmount)} ` +
            `with ${colors.magenta}${pot.winningRankName || 'Unknown'}${colors.reset}`,
        )
      }
    }
  }

  console.log()

  // Print ending stacks
  printHeader('Ending Stacks')
  for (const endPlayer of playerStacksEnd) {
    const startPlayer = playerStacksStart.find(
      (p) => p.player_id === endPlayer.player_id || p.position === endPlayer.position,
    )
    const playerName = startPlayer ? startPlayer.name : `Player ${endPlayer.position}`
    const playerPos = endPlayer.position
    const startChips = startPlayer ? startPlayer.chips : 0
    const change = endPlayer.chips - startChips
    const changeStr =
      change >= 0
        ? `${colors.green}+${change}${colors.reset}`
        : `${colors.red}${change}${colors.reset}`

    console.log(
      `  ${formatPlayerName(playerName, playerPos)}: ${formatChips(endPlayer.chips)} (${changeStr})`,
    )
  }

  printSeparator()
  console.log()
}

async function replayGame(roomCode, specificHandNumber = null) {
  // Get game
  const game = await db('games').where('room_code', roomCode).first()

  if (!game) {
    console.error(`${colors.red}Game not found with room code: ${roomCode}${colors.reset}`)
    return
  }

  // Get hands
  let handsQuery = db('hands').where('game_id', game.id).orderBy('hand_number')

  if (specificHandNumber !== null) {
    handsQuery = handsQuery.where('hand_number', specificHandNumber)
  }

  const hands = await handsQuery

  if (hands.length === 0) {
    console.error(`${colors.red}No hands found${colors.reset}`)
    return
  }

  console.log(
    `${colors.bright}${colors.cyan}Replaying ${hands.length} hand(s) from game ${roomCode}${colors.reset}\n`,
  )

  for (const hand of hands) {
    await replayHand(hand.id)

    // Pause between hands if replaying multiple
    if (hands.length > 1 && hand !== hands[hands.length - 1]) {
      console.log(`${colors.dim}Press Enter to continue to next hand...${colors.reset}`)
      await new Promise((resolve) => {
        process.stdin.once('data', () => resolve())
      })
    }
  }

  process.exit(0)
}

async function main() {
  const args = process.argv.slice(2)

  // Parse command line arguments
  let roomCode = null
  let handNumber = null
  let handId = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room' && args[i + 1]) {
      roomCode = args[i + 1]
      i++
    } else if (args[i] === '--hand' && args[i + 1]) {
      handNumber = parseInt(args[i + 1])
      i++
    } else if (args[i] === '--hand-id' && args[i + 1]) {
      handId = parseInt(args[i + 1])
      i++
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
${colors.bright}Hand Replay Utility${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node replay_hand.js --room ROOM_CODE              Replay all hands in a game
  node replay_hand.js --room ROOM_CODE --hand NUM   Replay specific hand number
  node replay_hand.js --hand-id ID                  Replay by hand ID

${colors.cyan}Examples:${colors.reset}
  node replay_hand.js --room YGPN4P
  node replay_hand.js --room YGPN4P --hand 2
  node replay_hand.js --hand-id 6

${colors.cyan}Options:${colors.reset}
  --room ROOM_CODE    Room code to replay
  --hand NUM          Specific hand number (requires --room)
  --hand-id ID        Specific hand ID
  --help, -h          Show this help message
`)
      process.exit(0)
    }
  }

  try {
    if (handId !== null) {
      await replayHand(handId)
    } else if (roomCode !== null) {
      await replayGame(roomCode, handNumber)
    } else {
      console.error(`${colors.red}Error: Must specify --room or --hand-id${colors.reset}`)
      console.log(`Run with --help for usage information`)
      process.exit(1)
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { replayHand, replayGame }
