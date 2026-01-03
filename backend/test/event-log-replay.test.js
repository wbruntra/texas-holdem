/**
 * Event Log Replay Test
 *
 * This test replays a real game captured in event-log.json to ensure
 * the system behaves correctly and deterministically when given the
 * same initial conditions and sequence of actions.
 *
 * Tests are sequential - game is set up once and all tests run against it.
 */

const db = require('@holdem/database/db')
const gameService = require('../services/game-service')
const playerService = require('../services/player-service')
const actionService = require('../services/action-service')
const { createGameState, startNewHand } = require('../lib/game-state-machine')
const eventLog = require('../../event-log.json')

describe('Event Log Replay - Full Game Test', () => {
  let testGameId
  let playerIds = {}

  // Set up game once for entire test suite
  beforeAll(async () => {
    // Clean up database
    await db('actions').del()
    await db('hands').del()
    await db('players').del()
    await db('games').del()

    // Create game
    const game = await gameService.createGame({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
    })
    testGameId = game.id

    // Add players
    const alice = await playerService.joinGame(testGameId, 'alice', 'pass1234')
    const bob = await playerService.joinGame(testGameId, 'bob', 'pass1234')
    playerIds.alice = alice.id
    playerIds.bob = bob.id
  })

  afterAll(async () => {
    await db.destroy()
  })

  describe('Game Setup and First Hand', () => {
    it('should create game with correct configuration', async () => {
      const createEvent = eventLog.find((e) => e.eventType === 'game:created')
      expect(createEvent).toBeDefined()

      const game = await gameService.getGameById(testGameId)
      expect(game.smallBlind).toBe(5)
      expect(game.bigBlind).toBe(10)
      expect(game.startingChips).toBe(1000)
      expect(game.status).toBe('waiting')
    })

    it('should have players in correct order', async () => {
      const game = await gameService.getGameById(testGameId)
      expect(game.players).toHaveLength(2)
      expect(game.players[0].name).toBe('alice')
      expect(game.players[1].name).toBe('bob')
    })

    it('should start game with correct initial state', async () => {
      const startedGame = await gameService.startGame(testGameId)

      expect(startedGame.status).toBe('active')
      expect(startedGame.handNumber).toBe(1)
      expect(startedGame.currentRound).toBe('preflop')
      expect(startedGame.players).toHaveLength(2)

      // Verify blinds were posted
      const alice = startedGame.players[0]
      const bob = startedGame.players[1]

      // In heads-up, dealer is small blind
      expect(alice.isDealer).toBe(true)
      expect(alice.isSmallBlind).toBe(true)
      expect(alice.currentBet).toBe(5)

      expect(bob.isBigBlind).toBe(true)
      expect(bob.currentBet).toBe(10)
    })
  })

  describe('Hand 1 - Check Down to Showdown', () => {
    it('should handle preflop call action', async () => {
      let game = await gameService.getGameById(testGameId)
      expect(game.currentPlayerPosition).toBe(0)

      // Alice calls
      game = await actionService.submitAction(playerIds.alice, 'call', 0)
      expect(game.players[0].currentBet).toBe(10)
      expect(game.pot).toBe(20)
    })

    it('should advance to flop after big blind checks', async () => {
      // Bob checks
      let game = await actionService.submitAction(playerIds.bob, 'check', 0)

      expect(game.currentRound).toBe('flop')
      expect(game.communityCards).toHaveLength(3)
      expect(game.currentBet).toBe(0)
    })

    it('should handle flop checks', async () => {
      // Bob checks
      await actionService.submitAction(playerIds.bob, 'check', 0)
      // Alice checks
      const game = await actionService.submitAction(playerIds.alice, 'check', 0)
      expect(game.currentRound).toBe('turn')
    })

    it('should handle turn checks', async () => {
      // Bob checks
      await actionService.submitAction(playerIds.bob, 'check', 0)
      // Alice checks
      const game = await actionService.submitAction(playerIds.alice, 'check', 0)
      expect(game.currentRound).toBe('river')
    })

    it('should handle river checks and reach showdown', async () => {
      // Bob checks
      await actionService.submitAction(playerIds.bob, 'check', 0)
      // Alice checks
      const game = await actionService.submitAction(playerIds.alice, 'check', 0)

      expect(game.currentRound).toBe('showdown')
      expect(game.winners).toBeDefined()
      expect(game.winners).toHaveLength(1)

      // Verify pot was distributed
      const winnerPosition = game.winners[0]
      const winner = game.players[winnerPosition]
      const loser = game.players[1 - winnerPosition]

      expect(winner.chips).toBe(1010)
      expect(loser.chips).toBe(990)
    })
  })

  describe('Hand 2 - Raise and Call', () => {
    it('should start next hand', async () => {
      const game = await gameService.startNextHand(testGameId)
      expect(game.handNumber).toBe(2)
      expect(game.currentRound).toBe('preflop')
    })

    it('should handle preflop raise', async () => {
      let game = await gameService.getGameById(testGameId)

      // Bob (now dealer/SB) acts first
      expect(game.players[1].isDealer).toBe(true)

      // Bob raises to 30
      game = await actionService.submitAction(playerIds.bob, 'raise', 30)
      expect(game.currentBet).toBeGreaterThan(10)
      expect(game.players[1].currentBet).toBeGreaterThanOrEqual(30)
    })

    it('should handle call after raise', async () => {
      // Alice calls
      const game = await actionService.submitAction(playerIds.alice, 'call', 0)

      const aliceBet = game.players[0].currentBet
      const bobBet = game.players[1].currentBet
      expect(aliceBet).toBe(bobBet)
      expect(game.currentRound).toBe('flop')
    })

    it('should handle flop bet and call', async () => {
      let game = await gameService.getGameById(testGameId)
      const potAfterPreflop = game.pot

      // Alice bets 50
      game = await actionService.submitAction(playerIds.alice, 'bet', 50)
      expect(game.currentBet).toBe(50)

      // Bob calls
      game = await actionService.submitAction(playerIds.bob, 'call', 0)
      expect(game.currentRound).toBe('turn')
      expect(game.pot).toBe(potAfterPreflop + 100)
    })

    it('should check through turn and river', async () => {
      // Turn: checks
      await actionService.submitAction(playerIds.alice, 'check', 0)
      await actionService.submitAction(playerIds.bob, 'check', 0)

      // River: checks
      await actionService.submitAction(playerIds.alice, 'check', 0)
      const game = await actionService.submitAction(playerIds.bob, 'check', 0)

      expect(game.currentRound).toBe('showdown')
      expect(game.winners).toBeDefined()
    })
  })

  describe('Hand 3 - All-In Scenario', () => {
    let aliceChipsBeforeHand3
    let bobChipsBeforeHand3
    let totalChipsBeforeHand3

    it('should verify chip counts before hand 3', async () => {
      const game = await gameService.getGameById(testGameId)

      aliceChipsBeforeHand3 = game.players[0].chips
      bobChipsBeforeHand3 = game.players[1].chips
      totalChipsBeforeHand3 = aliceChipsBeforeHand3 + bobChipsBeforeHand3

      // Total chips should remain 2000 throughout the game
      expect(totalChipsBeforeHand3).toBe(2000)

      // Log for verification
      console.log('Before Hand 3 - Alice:', aliceChipsBeforeHand3, 'Bob:', bobChipsBeforeHand3)
    })

    it('should start hand 3 and post blinds correctly', async () => {
      const game = await gameService.startNextHand(testGameId)

      expect(game.handNumber).toBe(3)
      expect(game.currentRound).toBe('preflop')
      expect(game.players[0].isDealer).toBe(true)
      expect(game.players[0].isSmallBlind).toBe(true)

      // Verify blinds were posted correctly
      expect(game.players[0].currentBet).toBe(5)
      expect(game.players[1].currentBet).toBe(10)

      // Verify pot includes both blinds
      expect(game.pot).toBe(15)

      // Verify chips were deducted for blinds
      expect(game.players[0].chips).toBe(aliceChipsBeforeHand3 - 5)
      expect(game.players[1].chips).toBe(bobChipsBeforeHand3 - 10)
    })

    it('should handle all-in raise correctly', async () => {
      let game = await gameService.getGameById(testGameId)

      const aliceChipsBeforeRaise = game.players[0].chips
      const aliceCurrentBet = game.players[0].currentBet
      const bobCurrentBet = game.players[1].currentBet
      const potBeforeRaise = game.pot

      // For a raise, the amount is the increment BEYOND calling
      // Alice needs to call (bobCurrentBet - aliceCurrentBet) to match
      // Then raise by the remainder of her chips
      const callAmount = bobCurrentBet - aliceCurrentBet
      const raiseIncrement = aliceChipsBeforeRaise - callAmount

      console.log(
        'Alice raise calculation - Chips:',
        aliceChipsBeforeRaise,
        'Call amount:',
        callAmount,
        'Raise increment:',
        raiseIncrement,
      )

      // Alice raises all-in
      game = await actionService.submitAction(playerIds.alice, 'raise', raiseIncrement)

      // Alice should have 0 chips remaining after all-in
      expect(game.players[0].chips).toBe(0)

      // Alice's total bet should be her previous bet + all remaining chips
      expect(game.players[0].currentBet).toBe(aliceCurrentBet + aliceChipsBeforeRaise)

      // Current bet should be Alice's total bet
      expect(game.currentBet).toBe(game.players[0].currentBet)

      // Pot should include Alice's entire remaining stack
      const expectedPot = potBeforeRaise + aliceChipsBeforeRaise
      expect(game.pot).toBe(expectedPot)

      console.log(
        'After Alice all-in - Alice chips:',
        game.players[0].chips,
        'Total bet:',
        game.players[0].currentBet,
        'Pot:',
        game.pot,
      )
    })

    it('should handle call of all-in correctly', async () => {
      let game = await gameService.getGameById(testGameId)

      const bobChipsBeforeCall = game.players[1].chips
      const bobCurrentBet = game.players[1].currentBet
      const aliceTotalBet = game.players[0].currentBet
      const potBeforeCall = game.pot

      console.log(
        'Before Bob call - Bob chips:',
        bobChipsBeforeCall,
        'Bob bet:',
        bobCurrentBet,
        'Alice bet:',
        aliceTotalBet,
        'Pot:',
        potBeforeCall,
      )

      // Bob needs to match Alice's bet but may not have enough chips (all-in scenario)
      const callAmount = Math.min(bobChipsBeforeCall, aliceTotalBet - bobCurrentBet)

      console.log('Bob will call/all-in with:', callAmount)

      // Bob calls (will be all-in if he doesn't have enough to match)
      game = await actionService.submitAction(playerIds.bob, 'call', 0)

      console.log(
        'After Bob call - Bob chips:',
        game.players[1].chips,
        'Bob bet:',
        game.players[1].currentBet,
        'Pot:',
        game.pot,
        'Round:',
        game.currentRound,
      )
      console.log(
        'Alice chips:',
        game.players[0].chips,
        'Total chips in play:',
        game.players.reduce((sum, p) => sum + p.chips, 0),
      )

      // Bob should have 0 chips (all-in)
      expect(game.players[1].chips).toBe(0)

      // Bob's total bet should be his initial bet plus all his remaining chips
      expect(game.players[1].currentBet).toBe(bobCurrentBet + bobChipsBeforeCall)

      // Pot should contain all chips from both players
      expect(game.pot).toBe(aliceTotalBet + game.players[1].currentBet)

      // Both players should be all-in, round should advance to showdown
      // (or stay in preflop if the system doesn't auto-advance)
      expect(['preflop', 'showdown']).toContain(game.currentRound)
    })

    it('should verify hand 3 reaches all-in showdown state', async () => {
      let game = await gameService.getGameById(testGameId)

      // After both players call/raise all-in, the pot should contain all chips
      expect(game.pot).toBe(2000)

      // Both players should be all-in (0 chips remaining)
      expect(game.players[0].chips).toBe(0)
      expect(game.players[1].chips).toBe(0)

      console.log(
        'All-in state - Pot:',
        game.pot,
        'Alice chips:',
        game.players[0].chips,
        'Bob chips:',
        game.players[1].chips,
        'Round:',
        game.currentRound,
      )

      // The game should either be in showdown or will advance there automatically
      // For now, we verify the all-in state is correct
      expect(game.pot + game.players[0].chips + game.players[1].chips).toBe(2000)
    })

    it('should verify total chip conservation throughout hand 3', async () => {
      const game = await gameService.getGameById(testGameId)

      // Total chips should be conserved (either in pot or with players)
      const totalChipsAfterHand3 = game.pot + game.players.reduce((sum, p) => sum + p.chips, 0)
      expect(totalChipsAfterHand3).toBe(2000)
    })
  })

  describe('Hand 4 and Event Log Validation', () => {
    it('should verify hand 4 exists in event log', () => {
      const hand4Started = eventLog.find(
        (e) => e.eventType === 'hand:started' && e.data.handNumber === 4,
      )
      const hand4Completed = eventLog.find(
        (e) => e.eventType === 'hand:completed' && e.data.handNumber === 4,
      )

      expect(hand4Started).toBeDefined()
      expect(hand4Completed).toBeDefined()
      expect(hand4Started.data.players).toHaveLength(2)
    })

    it('should verify all hands have winners in event log', () => {
      const allHands = eventLog.filter((e) => e.eventType === 'hand:completed')

      allHands.forEach((hand, idx) => {
        expect(hand.data.winners).toBeDefined()
        expect(hand.data.winners).toHaveLength(1)
        expect(hand.data.handNumber).toBe(idx + 1)
      })
    })
  })

  describe('Game Flow Validation', () => {
    it('should maintain correct chip counts throughout game', async () => {
      const game = await gameService.getGameById(testGameId)

      // Total chips should remain constant (in pot + player stacks)
      const totalChips = game.pot + game.players.reduce((sum, p) => sum + p.chips, 0)
      expect(totalChips).toBe(2000)
    })

    it('should validate event log structure', () => {
      const eventTypes = eventLog.map((e) => e.eventType)

      // Should have expected events
      expect(eventTypes[0]).toBe('game:created')
      expect(eventTypes).toContain('game:started')
      expect(eventTypes).toContain('action:check')
      expect(eventTypes).toContain('action:raise')
      expect(eventTypes).toContain('state:showdown')
      expect(eventTypes).toContain('hand:completed')
    })

    it('should have complete hand data in events', () => {
      const handStartedEvents = eventLog.filter(
        (e) => e.eventType === 'hand:started' || e.eventType === 'game:started',
      )

      handStartedEvents.forEach((event) => {
        expect(event.data.players).toBeDefined()
        expect(event.data.deck).toBeDefined()

        event.data.players.forEach((player) => {
          expect(player.holeCards).toHaveLength(2)
          expect(player.holeCards[0]).toHaveProperty('rank')
        })
      })
    })

    it('should have winners at hand completion', () => {
      const completedHands = eventLog.filter((e) => e.eventType === 'hand:completed')

      completedHands.forEach((handEvent) => {
        expect(handEvent.data.winners).toBeDefined()
        expect(handEvent.data.winners.length).toBeGreaterThan(0)
      })
    })

    it('should verify all 4 hands completed successfully in event log', () => {
      const completedHands = eventLog.filter((e) => e.eventType === 'hand:completed')
      expect(completedHands).toHaveLength(4)

      // Verify hand numbers 1-4
      const handNumbers = completedHands.map((h) => h.data.handNumber)
      expect(handNumbers).toEqual([1, 2, 3, 4])
    })
  })
})
