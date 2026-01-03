#!/usr/bin/env node
/**
 * Game Summary Utility
 *
 * Provides a quick summary of all hands in a game without the full replay.
 *
 * Usage:
 *   node summarize_game.js ROOM_CODE
 */

const db = require('./database/db')

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

async function summarizeGame(roomCode) {
  // Get game
  const game = await db('games').where('room_code', roomCode).first()

  if (!game) {
    console.error(`${colors.red}Game not found with room code: ${roomCode}${colors.reset}`)
    return
  }

  // Get hands
  const hands = await db('hands').where('game_id', game.id).orderBy('hand_number')

  console.log(
    `\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(`${colors.bright}${colors.cyan}  Game Summary: ${roomCode}${colors.reset}`)
  console.log(
    `${colors.bright}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`,
  )

  console.log(`${colors.dim}Game ID:${colors.reset} ${game.id}`)
  console.log(`${colors.dim}Status:${colors.reset} ${game.status}`)
  console.log(
    `${colors.dim}Blinds:${colors.reset} ${colors.yellow}$${game.small_blind}${colors.reset}/${colors.yellow}$${game.big_blind}${colors.reset}`,
  )
  console.log(
    `${colors.dim}Starting Chips:${colors.reset} ${colors.yellow}$${game.starting_chips}${colors.reset}`,
  )
  console.log(`${colors.dim}Total Hands:${colors.reset} ${hands.length}`)
  console.log()

  // Get all players from first hand
  if (hands.length > 0) {
    const firstHand = hands[0]
    const players = JSON.parse(firstHand.player_stacks_start || '[]')

    console.log(`${colors.bright}Players:${colors.reset}`)
    for (const player of players) {
      console.log(`  • ${colors.cyan}${player.name}${colors.reset} (Position ${player.position})`)
    }
    console.log()
  }

  console.log(`${colors.bright}Hand Summary:${colors.reset}`)
  console.log()

  for (const hand of hands) {
    const playerStacksStart = JSON.parse(hand.player_stacks_start || '[]')
    const playerStacksEnd = JSON.parse(hand.player_stacks_end || '[]')
    const pots = JSON.parse(hand.pots || '[]')
    const communityCards = JSON.parse(hand.community_cards || '[]')

    // Get action count
    const actionCount = await db('actions').where('hand_id', hand.id).count('* as count').first()

    console.log(
      `${colors.bright}Hand #${hand.hand_number}${colors.reset} ${colors.dim}(${actionCount.count} actions)${colors.reset}`,
    )

    // Show pot winners
    const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0)
    console.log(`  Pot: ${colors.yellow}$${totalPot}${colors.reset}`)

    for (const pot of pots) {
      if (pot.winners && pot.winners.length > 0) {
        for (const winnerPos of pot.winners) {
          const winner = playerStacksStart.find((p) => p.position === winnerPos)
          if (winner) {
            const winAmount = pot.winAmount || pot.amount
            console.log(
              `  ${colors.green}Winner:${colors.reset} ${colors.cyan}${winner.name}${colors.reset} ` +
                `won ${colors.yellow}$${winAmount}${colors.reset} with ${colors.bright}${pot.winningRankName}${colors.reset}`,
            )
          }
        }
      }
    }

    // Show stack changes
    console.log(`  Stack changes:`)
    for (const endPlayer of playerStacksEnd) {
      const startPlayer = playerStacksStart.find(
        (p) => p.player_id === endPlayer.player_id || p.position === endPlayer.position,
      )
      if (startPlayer) {
        const change = endPlayer.chips - startPlayer.chips
        const changeColor = change >= 0 ? colors.green : colors.red
        const changeSign = change >= 0 ? '+' : ''
        console.log(
          `    ${colors.cyan}${startPlayer.name}${colors.reset}: ` +
            `${colors.yellow}$${startPlayer.chips}${colors.reset} → ` +
            `${colors.yellow}$${endPlayer.chips}${colors.reset} ` +
            `(${changeColor}${changeSign}$${change}${colors.reset})`,
        )
      }
    }

    console.log()
  }

  // Show final standings if game is complete
  if (game.status === 'completed' && hands.length > 0) {
    const lastHand = hands[hands.length - 1]
    const finalStacks = JSON.parse(lastHand.player_stacks_end || '[]')

    console.log(`${colors.bright}${colors.cyan}Final Standings:${colors.reset}`)

    // Sort by chips descending
    finalStacks.sort((a, b) => b.chips - a.chips)

    for (let i = 0; i < finalStacks.length; i++) {
      const player = finalStacks[i]
      const startStack = game.starting_chips
      const change = player.chips - startStack
      const changeColor = change >= 0 ? colors.green : colors.red
      const changeSign = change >= 0 ? '+' : ''

      // Get player name from first hand
      const firstHand = hands[0]
      const players = JSON.parse(firstHand.player_stacks_start || '[]')
      const playerInfo = players.find((p) => p.position === player.position)
      const playerName = playerInfo ? playerInfo.name : `Player ${player.position}`

      const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`

      console.log(
        `  ${rank} ${colors.cyan}${playerName}${colors.reset}: ` +
          `${colors.yellow}$${player.chips}${colors.reset} ` +
          `(${changeColor}${changeSign}$${change}${colors.reset})`,
      )
    }
  }

  console.log()
}

async function main() {
  const roomCode = process.argv[2]

  if (!roomCode) {
    console.error(`${colors.red}Usage: node summarize_game.js ROOM_CODE${colors.reset}`)
    process.exit(1)
  }

  try {
    await summarizeGame(roomCode)
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

if (require.main === module) {
  main()
}

module.exports = { summarizeGame }
