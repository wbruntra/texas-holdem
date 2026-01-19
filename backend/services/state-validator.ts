import { deriveGameStateForGame } from '@/lib/state-derivation'
import * as gameService from '@/services/game-service'
import { getPlayersInGame } from '@/services/player-service'
import type { GameState, Player } from '@holdem/shared'

interface Discrepancy {
  path: string
  dbValue: any
  derivedValue: any
}

export interface ValidationResult {
  isValid: boolean
  differences: { path: string; expected: any; actual: any }[]
}

export function compareStates(derived: GameState, actual: any): ValidationResult {
  const discrepancies: { path: string; expected: any; actual: any }[] = []

  // Compare Game Level Fields
  const gameFieldsToCheck: (keyof GameState)[] = [
    'pot',
    'currentBet',
    'currentRound',
    'dealerPosition',
    'handNumber',
  ]

  gameFieldsToCheck.forEach((field) => {
    // @ts-ignore
    const dbVal = actual[field]
    const derivedVal = derived[field]

    // Simple strict equality for primitives
    if (dbVal != derivedVal) {
      // usage of != to catch null vs undefined
      if (field === 'currentRound' && !dbVal && !derivedVal) return // both null/undefined

      discrepancies.push({
        path: `game.${field}`,
        actual: dbVal,
        expected: derivedVal,
      })
    }
  })

  // Compare Players
  // Map DB players to structure for easy comparison
  const dbPlayers = actual.players.sort((a: Player, b: Player) => a.position - b.position)
  const derivedPlayers = derived.players.sort((a, b) => a.position - b.position)

  if (dbPlayers.length !== derivedPlayers.length) {
    discrepancies.push({
      path: 'players.length',
      actual: dbPlayers.length,
      expected: derivedPlayers.length,
    })
  } else {
    const playerFieldsToCheck: (keyof Player)[] = ['chips', 'currentBet', 'status']

    dbPlayers.forEach((dbP: Player, index: number) => {
      const derivedP = derivedPlayers[index]

      // Sanity check identity
      if (dbP.id !== derivedP.id) {
        discrepancies.push({
          path: `players[${index}].id`,
          actual: dbP.id,
          expected: derivedP.id,
        })
        return
      }

      playerFieldsToCheck.forEach((field) => {
        // @ts-ignore
        const dbVal = dbP[field]
        // @ts-ignore
        const derivedVal = derivedP[field]

        if (dbVal != derivedVal) {
          discrepancies.push({
            path: `players[${index}](${dbP.name}).${field}`,
            actual: dbVal,
            expected: derivedVal,
          })
        }
      })
    })
  }

  return {
    isValid: discrepancies.length === 0,
    differences: discrepancies,
  }
}

export async function validateGameState(gameId: number): Promise<boolean> {
  return true

  try {
    // 1. Fetch current DB State
    const dbGame = await gameService.getGameById(gameId)
    if (!dbGame) return false

    // 2. Derive State from Events
    const derivedState = await deriveGameStateForGame(gameId)

    // 3. Compare
    const result = compareStates(derivedState, dbGame)

    if (!result.isValid) {
      console.warn(`[STATE_VALIDATION_MISMATCH] Game ${gameId} Hand ${dbGame.handNumber}`)
      result.differences.forEach((d) => {
        console.warn(`  Diff at ${d.path}: DB=${d.actual} | Derived=${d.expected}`)
      })
      return false
    } else {
      console.log(
        `[STATE_VALIDATION_OK] Game ${gameId} Hand ${dbGame.handNumber} - State verified`,
      )
      return true
    }
  } catch (error) {
    console.error(`[STATE_VALIDATION_ERROR] Game ${gameId}:`, error)
    return false
  }
}
