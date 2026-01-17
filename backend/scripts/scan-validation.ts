// @ts-ignore
import db from '@holdem/database/db'
import { deriveGameStateForGame } from '@/lib/state-derivation'
import { compareStates } from '@/services/state-validator'

async function main() {
  console.log('Starting bulk validation scan...')

  const games = await db('games').select('id', 'room_code', 'current_round')
  console.log(`Found ${games.length} games.`)

  let passed = 0
  let failed = 0
  let errors = 0

  for (const game of games) {
    process.stdout.write(`Checking Game ${game.room_code} (ID: ${game.id})... `)

    try {
      // 1. Get Actual State
      const { getGameById } = await import('@/services/game-service')
      const actualState = await getGameById(game.id)

      if (!actualState) {
        console.log('Skipped (Not found via service)')
        continue
      }

      // 2. Derive State
      const derivedState = await deriveGameStateForGame(game.id)

      // 3. Compare
      const result = compareStates(derivedState, actualState)

      if (result.isValid) {
        console.log('✅ PASS')
        passed++
      } else {
        console.log('❌ FAIL')
        failed++
        console.log('  Mismatches:')
        result.differences.forEach((diff) => {
          console.log(`    - ${diff.path}: Expected '${diff.expected}', Got '${diff.actual}'`)
        })
      }
    } catch (err: any) {
      console.log('⚠️ ERROR')
      console.error(`  Failed to derive/validate: ${err.message}`)
      errors++
    }
  }

  console.log('\n=== SCAN COMPLETE ===')
  console.log(`Total: ${games.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Errors: ${errors}`)

  process.exit(failed > 0 || errors > 0 ? 1 : 0)
}

main().catch(console.error)
