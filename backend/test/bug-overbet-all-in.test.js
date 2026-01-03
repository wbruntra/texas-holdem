const { describe, it, expect, beforeEach } = require('bun:test')
const db = require('@holdem/root/db')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const { PLAYER_STATUS } = require('../lib/game-constants')

describe('Bug: Overbet forcing all-in', () => {
  let gameId
  let player1Id, player2Id

  beforeEach(async () => {
    // Clean database
    await db('actions').del()
    await db('hands').del()
    await db('games').del()
    await db('players').del()

    // Create game
    const game = await gameService.createGame({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
    })
    gameId = game.id

    // Join players
    const p1 = await playerService.joinGame(gameId, 'ShortStack', 'pass1')
    const p2 = await playerService.joinGame(gameId, 'BigStack', 'pass2')
    player1Id = p1.id
    player2Id = p2.id

    // Modify player1's chips to be short-stacked (50 chips)
    await db('players').where({ id: player1Id }).update({ chips: 50 })

    // Start game
    await gameService.startGame(gameId)
  })

  it('should handle when SB bets more than BB has remaining', async () => {
    console.log('\n🎯 Testing overbet scenario:\n')

    // Get initial state
    let state = await gameService.getGameById(gameId)
    console.log('Initial state (after blinds):')
    console.log(`  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}`)
    console.log(`  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}`)
    console.log(`  Pot: ${state.pot}\n`)

    // Determine who is SB and BB based on blinds
    const sbPlayer = state.players.find((p) => p.currentBet === 5)
    const bbPlayer = state.players.find((p) => p.currentBet === 10)

    console.log(`  SB is ${sbPlayer.name} with ${sbPlayer.chips} chips`)
    console.log(`  BB is ${bbPlayer.name} with ${bbPlayer.chips} chips\n`)

    // Preflop: SB calls, BB checks
    console.log('Preflop actions:')
    await actionService.submitAction(sbPlayer.id, 'call')
    console.log(`  ${sbPlayer.name} calls`)

    state = await gameService.getGameById(gameId)
    await actionService.submitAction(bbPlayer.id, 'check')
    console.log(`  ${bbPlayer.name} checks\n`)

    // Advance to flop
    state = await gameService.getGameById(gameId)
    console.log(
      `State before advancing: round=${state.currentRound}, currentPlayer=${state.currentPlayerPosition}`,
    )

    await gameService.advanceRoundIfReady(gameId)
    state = await gameService.getGameById(gameId)

    console.log('\nAfter flop dealt:')
    console.log(`  Round: ${state.currentRound}`)
    console.log(`  Community cards: ${state.communityCards?.length || 0}`)
    console.log(`  Current player position: ${state.currentPlayerPosition}`)
    console.log(`  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}`)
    console.log(
      `  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}\n`,
    )

    // BB checks
    const firstToAct = state.players[state.currentPlayerPosition]
    console.log(`Flop: ${firstToAct.name} checks`)
    await actionService.submitAction(firstToAct.id, 'check')

    state = await gameService.getGameById(gameId)
    const secondToAct = state.players[state.currentPlayerPosition]

    // SB bets 50 (more than BB has!)
    console.log(`Flop: ${secondToAct.name} bets $50`)
    await actionService.submitAction(secondToAct.id, 'bet', 50)

    state = await gameService.getGameById(gameId)
    console.log(`\nAfter bet:`)
    console.log(
      `  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}, status=${state.players[0].status}`,
    )
    console.log(
      `  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}, status=${state.players[1].status}`,
    )
    console.log(`  Pot: ${state.pot}`)
    console.log(`  CurrentBet: ${state.currentBet}`)
    console.log(`  Current player: ${state.currentPlayerPosition}\n`)

    // BB calls (should go all-in for remaining chips)
    const caller = state.players[state.currentPlayerPosition]
    console.log(`🔥 ${caller.name} (${caller.chips} chips) calls the $50 bet...`)

    try {
      await actionService.submitAction(caller.id, 'call')

      state = await gameService.getGameById(gameId)
      console.log(`\nAfter call:`)
      const callerAfter = state.players.find((p) => p.id === caller.id)
      console.log(`  ${caller.name}: chips=${callerAfter.chips}, status=${callerAfter.status}`)
      console.log(`  Pot: ${state.pot}`)
      console.log(`  CurrentBet: ${state.currentBet}`)
      console.log(`  Current player position: ${state.currentPlayerPosition}`)
      console.log(`  Round: ${state.currentRound}\n`)

      // Try to advance to turn
      console.log('Attempting to advance to turn...')
      await gameService.advanceRoundIfReady(gameId)
      state = await gameService.getGameById(gameId)

      console.log(`\nAfter advancing:`)
      console.log(`  Round: ${state.currentRound}`)
      console.log(`  Current player: ${state.currentPlayerPosition}`)
      console.log(
        `  P0: chips=${state.players[0].chips}, currentBet=${state.players[0].currentBet}, status=${state.players[0].status}`,
      )
      console.log(
        `  P1: chips=${state.players[1].chips}, currentBet=${state.players[1].currentBet}, status=${state.players[1].status}\n`,
      )

      // If someone can act, try to have them check
      if (state.currentPlayerPosition !== null) {
        const actor = state.players[state.currentPlayerPosition]
        console.log(`${actor.name} checks on turn...`)
        await actionService.submitAction(actor.id, 'check')

        state = await gameService.getGameById(gameId)
        console.log(`  After check: currentPlayerPosition=${state.currentPlayerPosition}`)
        console.log(`  P0 status: ${state.players[0].status}`)
        console.log(`  P1 status: ${state.players[1].status}\n`)

        // If there's another player to act, they should check too
        if (state.currentPlayerPosition !== null) {
          const secondActor = state.players[state.currentPlayerPosition]
          console.log(`${secondActor.name} also checks on turn...`)
          await actionService.submitAction(secondActor.id, 'check')

          state = await gameService.getGameById(gameId)
          console.log(
            `  After both checks: currentPlayerPosition=${state.currentPlayerPosition}\n`,
          )
        }

        // Check if we can advance or if we need another action
        if (state.currentPlayerPosition === null) {
          console.log(`✅ Betting complete after both players check (correct!)`)
        } else {
          console.log(`❌ Still waiting for another action - this is the bug!`)
          console.log(`   Player ${state.currentPlayerPosition} needs to act\n`)
        }
      } else {
        console.log(`✅ No one can act (all players all-in or only one player remaining)`)
      }
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}\n`)
      throw error
    }
  })
})
