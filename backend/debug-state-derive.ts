import db from '@holdem/database/db'
import { deriveGameState } from '@/lib/state-derivation'
import { getValidActions } from '@/lib/betting-logic'
import { getEvents, getHandEvents } from '@/services/event-store'

const roomCode = process.argv[2] || 'NVM9PB'

async function main() {
  console.log(`\n=== Debugging State Derivation for ${roomCode} ===\n`)

  // Get game metadata
  const metadata = await db('games').where({ room_code: roomCode }).first()
  if (!metadata) {
    console.log('Game not found')
    process.exit(1)
  }

  console.log('Game ID:', metadata.id)
  console.log('Current Hand:', metadata.hand_number)

  // Get ALL events for the game (including player joins from hand 0)
  const allEvents = await getEvents(metadata.id)
  const currentHandEvents = allEvents.filter((e) => e.handNumber === metadata.hand_number)

  console.log(`\nTotal events for game:`, allEvents.length)
  console.log(`Events in hand ${metadata.hand_number}:`, currentHandEvents.length)

  // Derive state
  const gameConfig = {
    smallBlind: metadata.small_blind,
    bigBlind: metadata.big_blind,
    startingChips: metadata.starting_chips,
  }

  const state = deriveGameState(gameConfig, [], allEvents)

  console.log('\n=== DERIVED STATE ===')
  console.log('Status:', state.status)
  console.log('Current Round:', state.currentRound)
  console.log('Current Player Position:', state.currentPlayerPosition)
  console.log('Action Finished:', state.action_finished)
  console.log('Current Bet:', state.currentBet)
  console.log('Pot:', state.pot)
  console.log('Dealer Position:', state.dealerPosition)

  console.log('\n=== PLAYERS ===')
  state.players.forEach((p, idx) => {
    console.log(
      `[${idx}] ${p.name} | Chips: ${p.chips} | Status: ${p.status} | Bet: ${p.currentBet} | Action: ${p.lastAction}`,
    )
  })

  console.log('\n=== VALID ACTIONS FOR EACH PLAYER ===')
  state.players.forEach((p, idx) => {
    const validActions = getValidActions(state, idx)
    console.log(`\nPlayer ${p.name} (position ${idx}):`)
    console.log(JSON.stringify(validActions, null, 2))
  })

  console.log('\n=== ALL-IN SITUATION CHECK ===')
  const activePlayers = state.players.filter((p) => p.status === 'active')
  const allInPlayers = state.players.filter((p) => p.status === 'all_in')
  console.log('Active players:', activePlayers.length)
  console.log('All-in players:', allInPlayers.length)
  console.log('Is all-in situation:', activePlayers.length <= 1 && allInPlayers.length > 0)

  console.log('\n=== LAST 5 EVENTS ===')
  currentHandEvents.slice(-5).forEach((e) => {
    console.log(
      `#${e.sequenceNumber} ${e.eventType} | Player: ${e.playerId || '-'} | Payload:`,
      JSON.stringify(e.payload).slice(0, 80),
    )
  })

  await db.destroy()
}

main().catch((err) => {
  console.error('Error:', err)
  db.destroy()
  process.exit(1)
})
