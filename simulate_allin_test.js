#!/usr/bin/env bun
/**
 * Test all-in chip duplication bug
 *
 * Scenario:
 * - Player A has 100 chips, goes all-in with 100
 * - Player B has 200 chips, calls by matching 100 (NOT going all-in)
 * - Pot should be 200, Player B keeps 100 chips
 * - Check that total chips are still 300 (no duplication)
 */

const db = require('./backend/db')
const { getGameById } = require('./backend/services/game-service')

async function simulateAllIn() {
  console.log('='.repeat(70))
  console.log('🧪 TESTING ALL-IN CHIP DUPLICATION BUG')
  console.log('='.repeat(70))

  let game = null
  let playerA = null
  let playerB = null

  try {
    // Step 1: Create a game
    console.log('\n📍 Step 1: Creating game...')
    const gameService = require('./backend/services/game-service')
    game = await gameService.createGame({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
    })
    console.log(`   Game created: ${game.roomCode} (ID: ${game.id})`)

    // Step 2: Add players
    console.log('\n📍 Step 2: Adding players...')
    const playerService = require('./backend/services/player-service')
    playerA = await playerService.joinGame(game.id, 'PlayerA', 'passwordA')
    console.log(`   PlayerA joined: ${playerA.id} (position: ${playerA.position})`)

    playerB = await playerService.joinGame(game.id, 'PlayerB', 'passwordB')
    console.log(`   PlayerB joined: ${playerB.id} (position: ${playerB.position})`)

    // Step 3: Set custom chip amounts (100 and 200)
    console.log('\n📍 Step 3: Setting chip amounts...')
    await db('players').where({ id: playerA.id }).update({ chips: 100 })
    await db('players').where({ id: playerB.id }).update({ chips: 200 })

    // Verify initial chip counts
    const p1 = await db('players').where({ id: playerA.id }).first()
    const p2 = await db('players').where({ id: playerB.id }).first()
    console.log(`   PlayerA chips: ${p1.chips}`)
    console.log(`   PlayerB chips: ${p2.chips}`)
    console.log(`   Total chips: ${p1.chips + p2.chips}`)

    // Step 4: Start the game
    console.log('\n📍 Step 4: Starting game...')
    const startedGame = await gameService.startGame(game.id)
    console.log(`   Game started! Status: ${startedGame.status}`)
    console.log(`   Hand number: ${startedGame.handNumber}`)
    console.log(`   Current round: ${startedGame.currentRound}`)

    // Get fresh state
    game = await getGameById(game.id)

    // Display blinds and initial state
    const dealer = game.players.find((p) => p.isDealer)
    const sb = game.players.find((p) => p.isSmallBlind)
    const bb = game.players.find((p) => p.isBigBlind)
    console.log(`   Dealer: ${dealer?.name || 'none'}`)
    console.log(`   Small Blind: ${sb?.name} (posted ${sb?.currentBet})`)
    console.log(`   Big Blind: ${bb?.name} (posted ${bb?.currentBet})`)

    // Step 5: Play the hand
    console.log('\n📍 Step 5: Playing the hand...')

    game = await getGameById(game.id)
    console.log(`\n   Initial state:`)
    console.log(
      `   Round: ${game.currentRound}, Pot: ${game.pot}, Current bet: ${game.currentBet}`,
    )
    console.log(`   Current player position: ${game.currentPlayerPosition}`)

    for (const p of game.players) {
      console.log(`   ${p.name}: chips=${p.chips}, currentBet=${p.currentBet}, status=${p.status}`)
    }

    // In heads-up: SB acts first preflop (left of dealer)
    // SB (PlayerA) has 100 chips, posted 5 SB = all-in!
    // BB (PlayerB) has 200 chips, posted 10 BB

    // Since PlayerA is all-in with 5 (their entire stack), they can't act further
    // PlayerB (BB) is first to act with remaining chips

    const actionService = require('./backend/services/action-service')

    game = await getGameById(game.id)
    const currentPlayerPos = game.currentPlayerPosition
    const currentPlayer = game.players[currentPlayerPos]

    console.log(`\n   🎰 ${currentPlayer.name}'s turn`)
    console.log(
      `   ${currentPlayer.name}: chips=${currentPlayer.chips}, currentBet=${currentPlayer.currentBet}, status=${currentPlayer.status}`,
    )

    // PlayerB (BB) needs to act first
    // Current bet is 10 (BB), PlayerA bet is 5 (all-in SB)
    // PlayerB can: check (if they match the bet), raise, or fold

    // Since SB is all-in with only 5, PlayerB's 10 is higher
    // PlayerB can check (their 10 is already > SB's 5)
    // Or raise

    // But we want PlayerA (100 chips) to go all-in and PlayerB (200) to call 100
    // Let's simulate a raise from PlayerA, then call from PlayerB

    // Actually, let's look at what the current player can do
    const actions = await actionService.getPlayerValidActions(currentPlayer.id)
    console.log(`   Valid actions: ${JSON.stringify(actions)}`)

    // The SB (PlayerA) is all-in with 5. In heads-up, SB acts first.
    // But since PlayerA only has 5 chips, they're all-in!
    // PlayerB is BB with 10.
    // The current bet is 10.
    // PlayerA (SB) already went all-in with 5.
    // PlayerB (BB) has matched 10, but since SB went all-in for less...

    // Wait, let me think about this differently.
    // We want: PlayerA bets 100, PlayerB calls 100.
    // To do this, PlayerA needs to raise from their all-in SB position.

    // Let PlayerA (SB) raise to their all-in amount
    // Since PlayerA has 95 more chips (100 - 5 posted), they can raise up to 95 more
    // But we want them to end up at 100 total bet, which means raising 90 more (5 + 90 = 95? No)

    // Let's trace:
    // - SB (A) posts 5, has 95 left, bet = 5
    // - BB (B) posts 10, has 190 left, bet = 10
    // - Current bet = 10
    // - SB to act: needs to call 5 more, or fold, or raise

    // If SB calls 5 more:
    // - SB chips: 90, bet: 10
    // - Pot: 15 + 5 = 20
    // - Current bet: 10
    // - BB to act: can check, raise, or fold

    // Then if SB raises all-in by 90 more:
    // - SB chips: 0, bet: 100
    // - Pot: 20 + 90 = 110
    // - Current bet: 100
    // - BB to act: needs to call 90 to match (or fold)

    // If BB calls 90:
    // - BB chips: 100 (190 - 90), bet: 100
    // - Pot: 110 + 90 = 200
    // - Both all-in, betting complete!
    // - Total chips: 0 + 100 = 100 for A, 100 + 100 = 200 for B... wait no

    // Let's recalculate:
    // Start: A=100, B=200, Total=300
    // SB posts 5: A=95 (bet=5), B=200 (bet=0)
    // BB posts 10: A=95 (bet=5), B=190 (bet=10)
    // A calls 5: A=90 (bet=10), B=190 (bet=10), Pot=20
    // A raises 90 (all-in): A=0 (bet=100), Pot=110
    // B calls 90: B=100 (bet=100), Pot=200
    // End: A=0, B=100, Pot=200, Total=300 ✓

    // Winner gets 200, so final: A=0, B=300 or A=200, B=100 depending on who wins
    // Total should always be 300!

    console.log(`\n   Step 5a: SB (PlayerA) calls to match BB...`)
    await actionService.submitAction(playerA.id, 'call', 0)

    game = await getGameById(game.id)
    console.log(`   After call:`)
    console.log(`   Pot: ${game.pot}, Current bet: ${game.currentBet}`)
    for (const p of game.players) {
      console.log(`   ${p.name}: chips=${p.chips}, currentBet=${p.currentBet}, status=${p.status}`)
    }

    // Now PlayerA can raise all-in
    // Current bet: 10, PlayerA bet: 10, PlayerA has 90 chips left
    // PlayerA can raise up to 90 (going all-in to 100)

    console.log(`\n   Step 5b: SB (PlayerA) raises all-in to 100 total bet...`)
    await actionService.submitAction(playerA.id, 'raise', 90)

    game = await getGameById(game.id)
    console.log(`   After raise:`)
    console.log(`   Pot: ${game.pot}, Current bet: ${game.currentBet}`)
    for (const p of game.players) {
      console.log(`   ${p.name}: chips=${p.chips}, currentBet=${p.currentBet}, status=${p.status}`)
    }

    // Now PlayerB needs to call 90 to match the 100 bet
    // PlayerB has 190 chips, so this is NOT all-in for them
    // PlayerB should have 100 chips left after calling

    console.log(`\n   Step 5c: BB (PlayerB) calls 90 (matching the all-in)...`)
    console.log(`   PlayerB should NOT go all-in - they keep their remaining chips!`)
    await actionService.submitAction(playerB.id, 'call', 0)

    game = await getGameById(game.id)
    console.log(`   After call:`)
    console.log(`   Pot: ${game.pot}, Current bet: ${game.currentBet}`)
    for (const p of game.players) {
      console.log(`   ${p.name}: chips=${p.chips}, currentBet=${p.currentBet}, status=${p.status}`)
    }

    // Verify PlayerB is NOT all-in
    const bAfterCall = game.players.find((p) => p.name === 'PlayerB')
    if (bAfterCall.status === 'all_in') {
      console.log(`\n   ⚠️  WARNING: PlayerB went all-in! This might be a bug.`)
      console.log(`   PlayerB should have 100 chips remaining, status should be 'active'`)
    } else {
      console.log(`\n   ✅ PlayerB is NOT all-in, has ${bAfterCall.chips} chips remaining`)
    }

    // Step 6: Advance to showdown
    console.log('\n📍 Step 6: Advancing to showdown...')

    // Auto-advance through rounds
    let attempts = 0
    while (game.currentRound !== 'showdown' && attempts < 10) {
      game = await gameService.advanceRoundIfReady(game.id)
      console.log(`   Advanced to: ${game.currentRound}, pot: ${game.pot}`)
      if (game.currentRound === 'showdown') break
      attempts++
    }

    // Step 7: Check final state
    console.log('\n📍 Step 7: Checking results...')
    game = await getGameById(game.id)

    console.log(`\n   Final State:`)
    console.log(`   Round: ${game.currentRound}`)
    console.log(`   Pot: ${game.pot}`)
    console.log(`   Winners: ${JSON.stringify(game.winners)}`)

    for (const p of game.players) {
      console.log(
        `   ${p.name}: chips=${p.chips}, currentBet=${p.currentBet}, totalBet=${p.totalBet}, status=${p.status}`,
      )
    }

    // Verify no chip duplication
    const finalA = game.players.find((p) => p.name === 'PlayerA')
    const finalB = game.players.find((p) => p.name === 'PlayerB')
    const totalChips = finalA.chips + finalB.chips
    const initialTotal = 100 + 200

    console.log(`\n   📊 CHIP COUNT VERIFICATION:`)
    console.log(`   Initial total: ${initialTotal} (PlayerA: 100, PlayerB: 200)`)
    console.log(
      `   Final total: ${totalChips} (PlayerA: ${finalA.chips}, PlayerB: ${finalB.chips})`,
    )

    // The pot should be awarded to the winner
    // If PlayerA won, they get 200 -> 0 + 200 = 200
    // If PlayerB won, they get 200 -> 100 + 200 = 300
    // Either way, total should be 300

    if (game.winners && game.winners.length > 0) {
      const winnerPos = game.winners[0]
      const winner = game.players[winnerPos]
      console.log(`   Winner: ${winner.name} (position ${winnerPos})`)
      console.log(`   ${winner.name} won ${game.pot > 0 ? game.pot : 'the pot'}`)
    }

    if (totalChips === initialTotal) {
      console.log(`\n   ✅ SUCCESS: No chip duplication detected!`)
      console.log(`   Total chips preserved: ${initialTotal} → ${totalChips}`)
    } else {
      console.log(`\n   ❌ BUG: Chip duplication detected!`)
      console.log(`   Expected: ${initialTotal}, Got: ${totalChips}`)
      console.log(`   Difference: ${totalChips - initialTotal}`)
    }

    // Also verify the pot was distributed correctly
    if (game.pots && game.pots.length > 0) {
      console.log(`\n   Pot distribution:`)
      for (const pot of game.pots) {
        console.log(
          `   - Pot amount: ${pot.amount}, Eligible: ${JSON.stringify(pot.eligiblePlayers)}, Winners: ${JSON.stringify(pot.winners)}`,
        )
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    // Cleanup
    if (game && game.id) {
      console.log('\n🧹 Cleaning up test game...')
      try {
        await db('actions')
          .whereIn('player_id', db('players').select('id').where({ game_id: game.id }))
          .delete()
        await db('hands').where({ game_id: game.id }).delete()
        await db('players').where({ game_id: game.id }).delete()
        await db('games').where({ id: game.id }).delete()
        console.log('   Test game deleted.')
      } catch (e) {
        console.error('   Cleanup error:', e.message)
      }
    }
    await db.destroy()
  }

  console.log('\n' + '='.repeat(70))
  console.log('🧪 TEST COMPLETE')
  console.log('='.repeat(70))
}

simulateAllIn()
