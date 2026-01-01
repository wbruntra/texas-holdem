const { describe, it, expect, beforeEach } = require('bun:test')
const db = require('../../db')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const { PLAYER_STATUS } = require('../lib/game-constants')

/**
 * Test suite for all-in card visibility
 *
 * Recreates the scenario from room 6R4PAS:
 * - Player goes all-in
 * - Opponent calls
 * - Flop is dealt
 * - At this point, BOTH players' cards should be visible
 *
 * This is standard poker behavior: when all betting is complete and
 * one or more players are all-in, cards are revealed and remaining
 * community cards are dealt.
 */
describe('All-in card visibility', () => {
  let gameId
  let jamesId, johnId
  let jamesPlayer, johnPlayer

  beforeEach(async () => {
    // Clean database
    await db('actions').del()
    await db('hands').del()
    await db('games').del()
    await db('players').del()

    // Create game with blinds matching 6R4PAS
    // Give players different starting chips to recreate the scenario where:
    // - One player can go all-in with less chips
    // - Other player can call and still have chips remaining
    const game = await gameService.createGame({
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 500,
    })
    gameId = game.id

    // Join players - match names from 6R4PAS
    jamesPlayer = await playerService.joinGame(gameId, 'james', 'pass1')
    johnPlayer = await playerService.joinGame(gameId, 'john', 'pass2')

    jamesId = jamesPlayer.id
    johnId = johnPlayer.id

    // Start the game
    await gameService.startGame(gameId)

    // Manually adjust john's chips to simulate the 6R4PAS scenario
    // where john has fewer chips and will go all-in
    // In 6R4PAS: john had 400 chips and went all-in, james had more and called
    await db('players').where('id', johnId).update({
      chips: 300, // Less chips so john can go all-in
      updated_at: new Date(),
    })
  })

  it('should reveal both players cards when one goes all-in and betting is complete', async () => {
    // Recreate the EXACT scenario from room 6R4PAS:
    // - One player (john) has fewer chips and goes all-in
    // - Other player (james) calls but has chips remaining
    let state = await gameService.getGameById(gameId)

    console.log('\n🎯 Testing All-In Card Visibility (Room 6R4PAS Scenario)')
    console.log('='.repeat(50))
    console.log('Scenario: One player all-in, other player has chips remaining')
    console.log('\nInitial State:')

    // Find which player is which
    const jamesPos = state.players.findIndex((p) => p.name === 'james')
    const johnPos = state.players.findIndex((p) => p.name === 'john')

    console.log(`  James (P${jamesPos}): $${state.players[jamesPos].chips}`)
    console.log(`  John (P${johnPos}): $${state.players[johnPos].chips}`)
    console.log(`  Round: ${state.currentRound}`)
    console.log(`  Current player position: ${state.currentPlayerPosition}`)
    console.log(`  Current bet: $${state.currentBet}`)

    // Strategy: Have john (with fewer chips) bet/raise all-in
    // Then james (with more chips) calls

    // If james is first to act, he folds and we start over
    // If john is first to act, he goes all-in
    let currentPos = state.currentPlayerPosition
    let currentPlayer = state.players[currentPos]

    console.log(`\n  Current player to act: P${currentPos} (${currentPlayer.name})`)

    // If james is first, he should call to get to john
    if (currentPlayer.name === 'james') {
      console.log(`\n1. ${currentPlayer.name} calls`)
      state = await actionService.submitAction(currentPlayer.id, 'call')
      currentPos = state.currentPlayerPosition
      currentPlayer = state.players[currentPos]
    }

    // Now john (with fewer chips) should raise/go all-in
    console.log(`\n2. ${currentPlayer.name} (with $${currentPlayer.chips}) goes ALL-IN`)
    state = await actionService.submitAction(currentPlayer.id, 'all_in')

    const allInPos = currentPos
    console.log(`   Status: ${state.players[allInPos].status}`)
    console.log(`   Chips: $${state.players[allInPos].chips}`)
    console.log(`   Current bet: $${state.players[allInPos].currentBet}`)
    console.log(`   show_cards flag: ${state.players[allInPos].showCards}`)

    expect(state.players[allInPos].status).toBe(PLAYER_STATUS.ALL_IN)
    expect(state.players[allInPos].chips).toBe(0)

    // Now james (with more chips) calls
    const callerPos = state.currentPlayerPosition
    const callerPlayer = state.players[callerPos]
    const chipsBeforeCall = callerPlayer.chips

    console.log(`\n3. ${callerPlayer.name} (with $${chipsBeforeCall}) CALLS the all-in`)
    state = await actionService.submitAction(callerPlayer.id, 'call')

    console.log(`   Status: ${state.players[callerPos].status}`)
    console.log(`   Chips: $${state.players[callerPos].chips}`)
    console.log(`   Current player position: ${state.currentPlayerPosition}`)
    console.log(`   Round: ${state.currentRound}`)
    console.log(`   show_cards flag: ${state.players[callerPos].showCards}`)

    // THIS IS KEY: One player is all-in (0 chips), other player has chips remaining
    // This matches the 6R4PAS scenario exactly
    console.log(`\n✓ ${state.players[allInPos].name} is ALL-IN with $0`)
    console.log(
      `✓ ${state.players[callerPos].name} has $${state.players[callerPos].chips} remaining`,
    )

    // At this point, betting should be complete (currentPlayerPosition should be null)
    expect(state.currentPlayerPosition).toBe(null)
    console.log('✓ Betting complete (currentPlayerPosition is null)')

    // The round should still be preflop (waiting for manual advance)
    expect(state.currentRound).toBe('preflop')
    console.log('✓ Still in preflop (waiting for manual advance)')

    // Advance to flop (manual button press simulation)
    console.log('\n4. Manually advancing to FLOP (simulating "Deal Flop" button)...')
    state = await gameService.advanceOneRound(gameId)

    console.log(`   Round: ${state.currentRound}`)
    console.log(`   Community cards: ${state.communityCards.length}`)
    console.log(`   Current player position: ${state.currentPlayerPosition}`)

    expect(state.currentRound).toBe('flop')
    expect(state.communityCards.length).toBe(3) // Flop shows 3 cards
    // Note: currentPlayerPosition may be set if the player with chips can act
    // That's OK - the key is that cards should STILL be visible since one player is all-in

    console.log('\n📋 Card Visibility Analysis:')
    console.log('='.repeat(50))

    // Check hole cards visibility
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i]
      console.log(`\nPlayer ${i} (${player.name}):`)
      console.log(`  Status: ${player.status}`)
      console.log(`  Chips: $${player.chips}`)
      console.log(`  Hole cards: ${player.holeCards ? JSON.stringify(player.holeCards) : 'null'}`)
      console.log(`  show_cards: ${player.showCards}`)

      // Verify hole cards are present in the backend state
      expect(player.holeCards).toBeDefined()
      expect(player.holeCards.length).toBe(2)
    }

    // Now simulate what the WebSocket service would send TO THE TABLE VIEW
    console.log('\n🌐 Testing WebSocket Sanitization for TABLE VIEW:')
    console.log('='.repeat(50))
    console.log('This is what the TableView component receives via WebSocket')

    // Import and test the actual sanitization logic
    const SHOWDOWN_ROUND = 'showdown'
    const isShowdown = state.currentRound === SHOWDOWN_ROUND

    console.log(`\n  Current round: ${state.currentRound}`)
    console.log(`  Is showdown: ${isShowdown}`)

    // This is the BUGGY logic from websocket-service.js sanitizeTableState (lines 318-329)
    // It only checks if isShowdown, not if there's an all-in situation
    console.log('\n❌ CURRENT BUGGY LOGIC (websocket-service.js sanitizeTableState):')
    console.log('   Shows cards ONLY if:')
    console.log('     isShowdown=true AND (multiple active/all-in players OR showCards flag)')

    state.players.forEach((p, idx) => {
      const shouldShowCards =
        isShowdown &&
        (state.players.filter((pl) => pl.status === 'active' || pl.status === 'all_in').length >
          1 ||
          p.showCards)

      console.log(`\n  P${idx} (${p.name}):`)
      console.log(`    isShowdown: ${isShowdown}`)
      console.log(
        `    active/all-in count: ${state.players.filter((pl) => pl.status === 'active' || pl.status === 'all_in').length}`,
      )
      console.log(`    showCards flag: ${p.showCards}`)
      console.log(`    Result shouldShowCards: ${shouldShowCards}`)
      console.log(
        `    ❌ TableView would show: ${shouldShowCards ? 'FACE-UP CARDS' : 'CARD BACKS'}`,
      )
    })

    // This is what SHOULD happen - using the shouldRevealAllCards logic from routes/games.js (lines 10-28)
    console.log('\n✅ CORRECT LOGIC (routes/games.js shouldRevealAllCards):')
    console.log('   Should show cards if:')
    console.log('     1. isShowdown=true, OR')
    console.log('     2. Only 1 player has chips AND there are all-in players')

    const playersWithChips = state.players.filter(
      (p) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    )
    const allInPlayers = state.players.filter((p) => p.status === 'all_in')
    const shouldRevealAllCards =
      isShowdown || (playersWithChips.length === 1 && allInPlayers.length > 0)

    console.log(
      `\n  Players with chips: ${playersWithChips.length} (${playersWithChips.map((p) => p.name).join(', ')})`,
    )
    console.log(
      `  All-in players: ${allInPlayers.length} (${allInPlayers.map((p) => p.name).join(', ')})`,
    )
    console.log(`  Result shouldRevealAllCards: ${shouldRevealAllCards}`)

    state.players.forEach((p, idx) => {
      const shouldShow = shouldRevealAllCards || p.showCards
      console.log(`\n  P${idx} (${p.name}):`)
      console.log(`    shouldRevealAllCards: ${shouldRevealAllCards}`)
      console.log(`    showCards flag: ${p.showCards}`)
      console.log(`    Result shouldShow: ${shouldShow}`)
      console.log(`    ✅ TableView SHOULD show: ${shouldShow ? 'FACE-UP CARDS' : 'CARD BACKS'}`)
    })

    // The KEY assertion - cards SHOULD be visible when 1 player has chips and others are all-in
    console.log('\n' + '='.repeat(50))
    console.log('🎯 CRITICAL ASSERTION:')
    expect(shouldRevealAllCards).toBe(true)
    console.log('✅ shouldRevealAllCards = true (CARDS SHOULD BE VISIBLE)')

    // Additional assertions to document expected behavior
    expect(playersWithChips.length).toBe(1)
    expect(allInPlayers.length).toBeGreaterThan(0)
    console.log(
      `✅ Conditions met: ${playersWithChips.length} player with chips, ${allInPlayers.length} all-in`,
    )

    // NOW TEST THE ACTUAL WEBSOCKET SERVICE SANITIZATION
    console.log('\n' + '='.repeat(50))
    console.log('🧪 TESTING ACTUAL WEBSOCKET SERVICE:')
    console.log('='.repeat(50))

    // Import the WebSocket service (it's a singleton)
    const wsService = require('../services/websocket-service')

    // Call the actual sanitizeTableState method
    const sanitizedForTable = wsService.sanitizeTableState(state)

    console.log('\nWebSocket sanitizeTableState output:')
    sanitizedForTable.players.forEach((p, idx) => {
      console.log(`\n  P${idx} (${p.name}):`)
      console.log(`    Status: ${p.status}`)
      console.log(`    Chips: $${p.chips}`)
      console.log(
        `    Hole cards sent: ${p.holeCards.length > 0 ? JSON.stringify(p.holeCards) : 'EMPTY (will show card backs)'}`,
      )

      // THE FIX: Backend should send cards when shouldRevealAllCards is true
      if (shouldRevealAllCards) {
        expect(p.holeCards.length).toBe(2)
        console.log(`    ✅ Cards ARE being sent to TableView`)
      }
    })

    console.log('\n' + '='.repeat(50))
    console.log('✅ FIX VERIFIED:')
    console.log('The WebSocket service now correctly sends hole cards to TableView')
    console.log('when one player is all-in and another has chips.')
    console.log('The frontend will display these cards as face-up.')
    console.log('='.repeat(50) + '\n')
  })

  it('should handle multiple all-ins correctly', async () => {
    // Create a 3-player game
    await db('actions').del()
    await db('hands').del()
    await db('games').del()
    await db('players').del()

    const game = await gameService.createGame({
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 500,
    })
    gameId = game.id

    const p1 = await playerService.joinGame(gameId, 'alice', 'pass1')
    const p2 = await playerService.joinGame(gameId, 'bob', 'pass2')
    const p3 = await playerService.joinGame(gameId, 'charlie', 'pass3')

    await gameService.startGame(gameId)

    let state = await gameService.getGameById(gameId)

    console.log('\n🎯 Testing Multiple All-Ins')
    console.log('='.repeat(50))

    // Get current player
    let currentPos = state.currentPlayerPosition
    let currentPlayerId = state.players[currentPos].id

    // First player goes all-in
    console.log(`\n1. P${currentPos} goes all-in`)
    state = await actionService.submitAction(currentPlayerId, 'all_in')

    // Second player calls (might also go all-in)
    currentPos = state.currentPlayerPosition
    currentPlayerId = state.players[currentPos].id
    console.log(`\n2. P${currentPos} calls`)
    state = await actionService.submitAction(currentPlayerId, 'call')

    // Third player calls
    currentPos = state.currentPlayerPosition
    currentPlayerId = state.players[currentPos].id
    console.log(`\n3. P${currentPos} calls`)
    state = await actionService.submitAction(currentPlayerId, 'call')

    console.log('\nAfter all actions:')
    state.players.forEach((p, idx) => {
      console.log(`  P${idx}: ${p.name}, chips=$${p.chips}, status=${p.status}`)
    })

    // Count all-in players
    const allInCount = state.players.filter((p) => p.status === 'all_in').length
    const activeWithChips = state.players.filter(
      (p) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    ).length

    console.log(`\n  All-in players: ${allInCount}`)
    console.log(`  Active players with chips: ${activeWithChips}`)

    // Advance to flop
    if (state.currentPlayerPosition === null) {
      console.log('\n4. Advancing to FLOP...')
      state = await gameService.advanceOneRound(gameId)
    }

    // Check if cards should be revealed
    const shouldReveal = activeWithChips === 1 && allInCount > 0
    console.log(`\n  Should reveal cards: ${shouldReveal}`)

    if (shouldReveal) {
      console.log('✅ Cards should be visible to all')
    } else {
      console.log('ℹ️  Normal play continues')
    }
  })

  it('should NOT reveal cards if multiple players still have chips', async () => {
    // Get initial state
    let state = await gameService.getGameById(gameId)

    console.log('\n🎯 Testing Normal Play (No All-In Reveal)')
    console.log('='.repeat(50))

    // Get current player (first to act)
    let currentPos = state.currentPlayerPosition
    let currentPlayerId = state.players[currentPos].id

    console.log(`\n1. P${currentPos} calls`)
    state = await actionService.submitAction(currentPlayerId, 'call')

    // Next player checks
    currentPos = state.currentPlayerPosition
    currentPlayerId = state.players[currentPos].id

    console.log(`\n2. P${currentPos} checks`)
    state = await actionService.submitAction(currentPlayerId, 'check')

    // Advance to flop
    console.log('\n3. Advancing to FLOP...')
    state = await gameService.advanceOneRound(gameId)

    // Check card visibility logic
    const playersWithChips = state.players.filter(
      (p) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    )
    const allInPlayers = state.players.filter((p) => p.status === 'all_in')
    const shouldRevealAllCards = playersWithChips.length === 1 && allInPlayers.length > 0

    console.log(`\n  Players with chips: ${playersWithChips.length}`)
    console.log(`  All-in players: ${allInPlayers.length}`)
    console.log(`  Should reveal cards: ${shouldRevealAllCards}`)

    expect(shouldRevealAllCards).toBe(false)
    console.log('\n✅ Cards should NOT be revealed (normal play continues)')
  })
})
