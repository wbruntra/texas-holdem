// @ts-ignore
import db from '@holdem/database/db'
import { getValidActions } from '@/lib/betting-logic'

const roomCode = process.argv[2]
if (!roomCode) {
  console.error('Usage: bun run scripts/debug-game-state.ts <ROOM_CODE>')
  process.exit(1)
}

async function main() {
  const game = await db('games').where({ room_code: roomCode }).first()
  if (!game) {
    console.error('Game not found')
    process.exit(1)
  }

  const players = await db('players').where({ game_id: game.id }).orderBy('position')
  const gameState = { ...game, players }

  console.log('=== GAME STATE ===')
  console.log(`ID: ${game.id}`)
  console.log(`Round: ${game.current_round}`)
  console.log(`Current Player Pos: ${game.current_player_position}`)
  console.log(`Action Finished: ${game.action_finished}`)
  console.log(`Status: ${game.status}`)
  console.log(`Pot: ${game.pot}`)
  console.log(`Current Bet: ${game.current_bet}`)

  console.log('\n=== PLAYERS ===')
  players.forEach((p: any) => {
    console.log(
      `[${p.position}] ${p.name} | Chips: ${p.chips} | Status: ${p.status} | Bet: ${p.current_bet}`,
    )
  })

  // Check valid actions for active players
  console.log('\n=== VALID ACTIONS ===')
  for (const p of players) {
    const actions = getValidActions(gameState as any, p.position)
    console.log(`Player ${p.name} (${p.position}):`, JSON.stringify(actions, null, 2))
  }

  process.exit(0)
}

main().catch(console.error)
