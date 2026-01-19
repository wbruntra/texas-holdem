import { deriveGameState } from '../lib/state-derivation'
import { getEvents } from '../services/event-store'
import { getGameMetadata } from '../services/game-service'
import db from '@holdem/database/db'

async function measurePerformance(gameId: number) {
  console.log(`Benchmarking Game ID: ${gameId}`)

  try {
    // 1. Fetch Data
    console.time('Fetch Data')
    const metadata = await getGameMetadata(gameId)
    if (!metadata) {
      console.error('Game not found')
      process.exit(1)
    }
    const events = await getEvents(gameId)
    console.timeEnd('Fetch Data')

    console.log(`Total Events: ${events.length}`)

    const gameConfig = {
      smallBlind: metadata.smallBlind,
      bigBlind: metadata.bigBlind,
      startingChips: metadata.startingChips,
    }

    // 2. Measure Derivation
    console.time('Derive State')
    const start = performance.now()

    const state = deriveGameState(gameConfig, [], events)

    const end = performance.now()
    console.timeEnd('Derive State')

    console.log(`\nTime taken: ${(end - start).toFixed(4)}ms`)
    console.log(`Average time per event: ${((end - start) / events.length).toFixed(4)}ms`)

    console.log('\nFinal State Summary:')
    console.log('Hand Number:', state.handNumber)
    console.log('Pot:', state.pot)
    console.log('Players:', state.players.length)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await db.destroy()
  }
}

// Run for Game 11
measurePerformance(11)
