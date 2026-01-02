const { describe, test, expect } = require('bun:test')
const { calculatePots, distributePots } = require('../lib/pot-manager')
const { evaluateHand } = require('../lib/poker-engine')

describe('Showdown Pot Display', () => {
  test('should calculate pots correctly BEFORE showdown is processed', () => {
    // This is the state BEFORE processShowdown is called
    const players = [
      {
        id: 31,
        name: 'bill',
        position: 0,
        chips: 980,
        currentBet: 0,
        totalBet: 20, // had bet 20 (big blind)
        status: 'active',
        holeCards: [
          { rank: 'J', suit: 'clubs' },
          { rank: '3', suit: 'clubs' },
        ],
      },
      {
        id: 32,
        name: 'tom',
        position: 1,
        chips: 1000,
        currentBet: 0,
        totalBet: 20, // had bet 20 (called)
        status: 'active',
        holeCards: [
          { rank: '2', suit: 'hearts' },
          { rank: '10', suit: 'spades' },
        ],
      },
    ]

    const communityCards = [
      { rank: '5', suit: 'spades' },
      { rank: 'A', suit: 'clubs' },
      { rank: 'A', suit: 'diamonds' },
      { rank: 'A', suit: 'hearts' },
      { rank: '2', suit: 'clubs' },
    ]

    // Calculate pots from player bets
    const pots = calculatePots(players)

    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(40) // 20 + 20

    // Distribute pots to determine winners
    const distributedPots = distributePots(pots, players, communityCards, evaluateHand)

    expect(distributedPots).toHaveLength(1)
    expect(distributedPots[0].winners).toHaveLength(1)

    // tom (position 1) has Full House (AAA22)
    // bill (position 0) has Three of a Kind (AAA)
    expect(distributedPots[0].winners[0]).toBe(1) // tom wins
    expect(distributedPots[0].winAmount).toBe(40)
    expect(distributedPots[0].winningRankName).toBe('Full House')
  })

  test('processShowdown should NOT clear bets - they remain for display', () => {
    // Simulate the game state before showdown
    const { processShowdown } = require('../lib/game-state-machine')

    const state = {
      status: 'active',
      currentRound: 'river',
      pot: 0,
      currentBet: 0,
      communityCards: [
        { rank: '5', suit: 'spades' },
        { rank: 'A', suit: 'clubs' },
        { rank: 'A', suit: 'diamonds' },
        { rank: 'A', suit: 'hearts' },
        { rank: '2', suit: 'clubs' },
      ],
      players: [
        {
          id: 31,
          name: 'bill',
          position: 0,
          chips: 980,
          currentBet: 0,
          totalBet: 20,
          status: 'active',
          holeCards: [
            { rank: 'J', suit: 'clubs' },
            { rank: '3', suit: 'clubs' },
          ],
        },
        {
          id: 32,
          name: 'tom',
          position: 1,
          chips: 1000,
          currentBet: 0,
          totalBet: 20,
          status: 'active',
          holeCards: [
            { rank: '2', suit: 'hearts' },
            { rank: '10', suit: 'spades' },
          ],
        },
      ],
    }

    const result = processShowdown(state)

    // After showdown, bets should NOT be cleared
    expect(result.players[0].totalBet).toBe(20)
    expect(result.players[1].totalBet).toBe(20)

    // But chips should be awarded to winner (tom)
    expect(result.players[0].chips).toBe(980) // bill lost
    expect(result.players[1].chips).toBe(1040) // tom won 40 (20+20)

    // Winners should be set
    expect(result.winners).toContain(1)

    // Now we can still calculate pots for display
    const pots = calculatePots(result.players)
    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(40)
  })

  test('should handle the case AFTER showdown is processed (bets cleared)', () => {
    // This would be AFTER starting next hand, when bets ARE cleared
    const players = [
      {
        id: 31,
        name: 'bill',
        position: 0,
        chips: 980, // lost the hand
        currentBet: 0, // cleared
        totalBet: 0, // cleared
        status: 'active',
        holeCards: [
          { rank: 'J', suit: 'clubs' },
          { rank: '3', suit: 'clubs' },
        ],
      },
      {
        id: 32,
        name: 'tom',
        position: 1,
        chips: 1020, // won 40
        currentBet: 0, // cleared
        totalBet: 0, // cleared
        status: 'active',
        holeCards: [
          { rank: '2', suit: 'hearts' },
          { rank: '10', suit: 'spades' },
        ],
      },
    ]

    const communityCards = [
      { rank: '5', suit: 'spades' },
      { rank: 'A', suit: 'clubs' },
      { rank: 'A', suit: 'diamonds' },
      { rank: 'A', suit: 'hearts' },
      { rank: '2', suit: 'clubs' },
    ]

    // Calculate pots - will be empty because bets are cleared
    const pots = calculatePots(players)

    expect(pots).toHaveLength(0) // This is the problem!

    // We can't calculate pot information after showdown is processed
    // The solution is to either:
    // 1. Store pots in the database
    // 2. Calculate pot info BEFORE clearing bets
    // 3. Store hand history with pot information
  })

  test('should correctly evaluate hands in the real scenario', () => {
    const communityCards = [
      { rank: '5', suit: 'spades' },
      { rank: 'A', suit: 'clubs' },
      { rank: 'A', suit: 'diamonds' },
      { rank: 'A', suit: 'hearts' },
      { rank: '2', suit: 'clubs' },
    ]

    // bill's hand: J♣ 3♣
    const billHand = evaluateHand(
      [
        { rank: 'J', suit: 'clubs' },
        { rank: '3', suit: 'clubs' },
      ],
      communityCards,
    )

    // tom's hand: 2♥ 10♠
    const tomHand = evaluateHand(
      [
        { rank: '2', suit: 'hearts' },
        { rank: '10', suit: 'spades' },
      ],
      communityCards,
    )

    console.log('bill hand:', billHand.rankName, billHand.description)
    console.log('tom hand:', tomHand.rankName, tomHand.description)

    // tom should have Full House (AAA22)
    expect(tomHand.rankName).toBe('Full House')

    // bill should have Three of a Kind (AAA with J kicker)
    expect(billHand.rankName).toBe('Three of a Kind')

    // tom's hand should be better
    expect(tomHand.rank).toBeGreaterThan(billHand.rank)
  })

  test('real game scenario - calculate from chip difference', () => {
    // Alternative approach: calculate pot from chip changes
    const startingChips = 1000

    const players = [
      { name: 'bill', position: 0, chips: 980 },
      { name: 'tom', position: 1, chips: 1020 },
    ]

    const totalChips = players.reduce((sum, p) => sum + p.chips, 0)
    expect(totalChips).toBe(2000) // Total should remain constant

    // Calculate how much was bet by looking at chip changes
    const billLost = startingChips - 980 // 20
    const tomWon = 1020 - startingChips // 20

    expect(billLost).toBe(20)
    expect(tomWon).toBe(20)

    // The pot was 40 (bill's 20 + tom's 20 call)
    const potAmount = billLost + tomWon
    expect(potAmount).toBe(40)
  })
})
