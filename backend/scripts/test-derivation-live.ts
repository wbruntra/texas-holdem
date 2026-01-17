// @ts-ignore
import { deriveGameStateForGame } from '../lib/state-derivation'
import db from '@holdem/database/db'

const roomCode = process.argv[2] || 'YU2PYD'

async function main() {
  console.log(`Deriving state for room ${roomCode}...`)

  const game = await db('games').where({ room_code: roomCode }).first()
  if (!game) {
    console.error('Game not found')
    process.exit(1)
  }

  const state = await deriveGameStateForGame(game.id)

  console.log('\n=== DERIVED STATE ===')
  console.log(`Round: ${state.currentRound}`)
  console.log(`Pot: ${state.pot}`)
  console.log(`Current Bet: ${state.currentBet}`)
  console.log('Players:')
  state.players.forEach((p) => {
    console.log(
      `  ${p.name} (Pos ${p.position}): ${p.chips} chips, Bet ${p.currentBet}, Status: ${p.status}`,
    )
  })

  console.log('\nVerifying against DB state...')
  console.log(`DB Pot: ${game.pot}`)
  console.log(`DB Current Bet: ${game.current_bet}`)

  const dbPlayers = await db('players').where({ game_id: game.id }).orderBy('position')
  dbPlayers.forEach((p: any) => {
    const derivedPlayer = state.players.find((dp) => dp.id === p.id)
    if (derivedPlayer) {
      const chipMatch = p.chips === derivedPlayer.chips ? 'OK' : `FAIL (DB: ${p.chips})`
      console.log(`  ${p.name}: Chips match? ${chipMatch}`)
    }
  })

  process.exit(0)
}

main().catch(console.error)
