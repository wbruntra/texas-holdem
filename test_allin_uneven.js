#!/usr/bin/env bun

/**
 * All-in with Uneven Stacks Test
 * Tests that side pots are handled correctly when one player has fewer chips
 * Runs 10 iterations to verify correct chip handling
 */

const {
  shuffleDeck,
  createDeck,
  dealHoleCards,
  evaluateHand,
} = require('./backend/lib/poker-engine')
const { calculatePots, awardPots } = require('./backend/lib/pot-manager')

const SMALL_BLIND = 5
const BIG_BLIND = 10
const STARTING_CHIPS = 800

function createGame(player0Chips, player1Chips) {
  return {
    status: 'waiting',
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    startingChips: STARTING_CHIPS,
    dealerPosition: 0,
    currentRound: null,
    pot: 0,
    communityCards: [],
    currentBet: 0,
    currentPlayerPosition: null,
    handNumber: 0,
    lastRaise: 0,
    deck: [],
    winners: [],
    players: [
      {
        id: '0',
        name: 'Player0',
        position: 0,
        chips: player0Chips,
        currentBet: 0,
        totalBet: 0,
        holeCards: [],
        status: 'active',
        isDealer: false,
        isSmallBlind: false,
        isBigBlind: false,
        lastAction: null,
      },
      {
        id: '1',
        name: 'Player1',
        position: 1,
        chips: player1Chips,
        currentBet: 0,
        totalBet: 0,
        holeCards: [],
        status: 'active',
        isDealer: false,
        isSmallBlind: false,
        isBigBlind: false,
        lastAction: null,
      },
    ],
  }
}

function dealCommunityCards(game, count) {
  const deck = game.deck
  const cards = deck.slice(0, count)
  return {
    ...game,
    deck: deck.slice(count),
    communityCards: [...game.communityCards, ...cards],
  }
}

function postBlinds(game) {
  const players = game.players.map((p) => ({
    ...p,
    currentBet: 0,
    totalBet: 0,
    status: p.chips > 0 ? 'active' : 'out',
  }))

  const activePlayers = players.filter((p) => p.status === 'active')
  if (activePlayers.length < 2) {
    return { ...game, status: 'completed', players }
  }

  const dealerPos = game.dealerPosition
  const sbPos = dealerPos
  const bbPos = (dealerPos + 1) % players.length

  players[sbPos].isSmallBlind = true
  players[bbPos].isBigBlind = true

  const sbAmount = Math.min(players[sbPos].chips, SMALL_BLIND)
  const bbAmount = Math.min(players[bbPos].chips, BIG_BLIND)

  players[sbPos].chips -= sbAmount
  players[sbPos].currentBet = sbAmount
  players[sbPos].totalBet = sbAmount

  players[bbPos].chips -= bbAmount
  players[bbPos].currentBet = bbAmount
  players[bbPos].totalBet = bbAmount

  const deck = shuffleDeck(createDeck())
  const dealResult = dealHoleCards(deck, 2)
  const playersToDeal = players.filter((p) => p.status === 'active')
  playersToDeal.forEach((p, i) => {
    const player = players.find((pl) => pl.position === p.position)
    player.holeCards = dealResult.players[i]
  })

  return {
    ...game,
    status: 'active',
    currentRound: 'preflop',
    pot: sbAmount + bbAmount,
    currentBet: bbAmount,
    lastRaise: 0,
    deck: dealResult.deck,
    handNumber: game.handNumber + 1,
    communityCards: [],
    players,
    currentPlayerPosition: bbPos,
  }
}

function processAction(game, playerPos, action, amount = 0) {
  const players = game.players.map((p) => ({ ...p }))
  let newPot = game.pot
  let newCurrentBet = game.currentBet
  let newLastRaise = game.lastRaise
  const p = { ...players[playerPos] }

  switch (action) {
    case 'check':
      p.lastAction = 'check'
      break
    case 'call': {
      const callAmt = Math.min(game.currentBet - p.currentBet, p.chips)
      p.chips -= callAmt
      p.currentBet += callAmt
      p.totalBet += callAmt
      newPot += callAmt
      p.lastAction = 'call'
      if (p.chips === 0) p.status = 'all_in'
      break
    }
    case 'bet': {
      const actualAmount = Math.min(amount, p.chips)
      p.chips -= actualAmount
      p.currentBet += actualAmount
      p.totalBet += actualAmount
      newPot += actualAmount
      newCurrentBet = p.currentBet
      newLastRaise = actualAmount
      p.lastAction = 'bet'
      if (p.chips === 0) p.status = 'all_in'
      break
    }
    case 'raise': {
      const totalBet = Math.min(game.currentBet - p.currentBet + amount, p.chips)
      const raiseAmount = totalBet - p.currentBet
      p.chips -= totalBet
      p.currentBet = totalBet
      p.totalBet += totalBet
      newPot += totalBet
      newCurrentBet = totalBet
      newLastRaise = raiseAmount
      p.lastAction = 'raise'
      if (p.chips === 0) p.status = 'all_in'
      break
    }
    case 'fold':
      p.status = 'folded'
      p.lastAction = 'fold'
      break
  }

  players[playerPos] = p

  const foldedPlayers = players.filter((pl) => pl.status === 'folded')
  const activePlayers = players.filter((pl) => pl.status === 'active')
  const allInPlayers = players.filter((pl) => pl.status === 'all_in')

  if (foldedPlayers.length === players.length - 1 && activePlayers.length === 1) {
    return {
      ...game,
      players,
      pot: newPot,
      currentBet: newCurrentBet,
      lastRaise: newLastRaise,
      currentPlayerPosition: null,
    }
  }

  if (activePlayers.length + allInPlayers.length <= 1) {
    return {
      ...game,
      players,
      pot: newPot,
      currentBet: newCurrentBet,
      lastRaise: newLastRaise,
      currentPlayerPosition: null,
    }
  }

  const playersWhoCanAct = players.filter((pl) => pl.status === 'active')
  const allMatched = playersWhoCanAct.every((pl) => pl.currentBet >= newCurrentBet)
  const allActed = playersWhoCanAct.every((pl) => pl.lastAction !== null)

  if (allMatched && allActed) {
    return {
      ...game,
      players,
      pot: newPot,
      currentBet: newCurrentBet,
      lastRaise: newLastRaise,
      currentPlayerPosition: null,
    }
  }

  let nextPos = (playerPos + 1) % players.length
  let attempts = 0
  while (attempts < players.length) {
    if (players[nextPos].status === 'active') break
    nextPos = (nextPos + 1) % players.length
    attempts++
  }

  return {
    ...game,
    players,
    pot: newPot,
    currentBet: newCurrentBet,
    lastRaise: newLastRaise,
    currentPlayerPosition: nextPos,
  }
}

function isBettingComplete(game) {
  const active = game.players.filter((p) => p.status === 'active')
  const allIn = game.players.filter((p) => p.status === 'all_in')

  if (active.length === 0) return true
  if (active.length === 1 && allIn.length === 0) return true

  const playersWithChips = game.players.filter((p) => p.status === 'active' && p.chips > 0)
  if (playersWithChips.length === 0) return true

  const canAct = active.filter((p) => p.status === 'active')
  if (canAct.length === 1) {
    const p = canAct[0]
    return p.currentBet >= game.currentBet && p.lastAction !== null
  }

  if (canAct.length === 0) return true

  return active.every((p) => p.currentBet >= game.currentBet && p.lastAction !== null)
}

function advanceRound(game) {
  if (isBettingComplete(game)) {
    const players = game.players.map((p) => ({ ...p, currentBet: 0, lastAction: null }))
    let newRound = null
    let result = null

    switch (game.currentRound) {
      case 'preflop':
        result = dealCommunityCards(game, 3)
        newRound = 'flop'
        break
      case 'flop':
        result = dealCommunityCards(game, 1)
        newRound = 'turn'
        break
      case 'turn':
        result = dealCommunityCards(game, 1)
        newRound = 'river'
        break
      case 'river':
        newRound = 'showdown'
        break
    }

    return {
      ...game,
      currentRound: newRound,
      communityCards: result ? result.communityCards : game.communityCards,
      deck: result ? result.deck : game.deck,
      players,
      currentBet: 0,
      lastRaise: 0,
      currentPlayerPosition: null,
    }
  }
  return game
}

function processShowdown(game) {
  const eligible = game.players.filter((p) => p.status === 'active' || p.status === 'all_in')

  if (eligible.length === 1) {
    const winner = eligible[0]
    const players = game.players.map((p) =>
      p.id === winner.id ? { ...p, chips: p.chips + game.pot } : p,
    )
    return {
      ...game,
      status: 'completed',
      pot: 0,
      players: players.map((p) => ({ ...p, currentBet: 0, totalBet: 0 })),
      winners: [winner.position],
    }
  }

  const pots = calculatePots(game.players)
  console.log(`      Calculated ${pots.length} pot(s):`)
  pots.forEach((pot, i) => {
    console.log(
      `        Pot ${i + 1}: $${pot.amount}, eligible: [${pot.eligiblePlayers.join(', ')}]`,
    )
  })

  const evalResult = pots.map((pot) => {
    const eligiblePlayers = pot.eligiblePlayers.map((pos) => ({
      position: pos,
      player: game.players[pos],
    }))
    const evaluations = eligiblePlayers.map((ep) => ({
      position: ep.position,
      hand: evaluateHand(ep.player.holeCards, game.communityCards),
    }))
    let best = evaluations[0].hand
    for (const e of evaluations) {
      if (e.hand.rank > best.rank || (e.hand.rank === best.rank && e.hand.value > best.value)) {
        best = e.hand
      }
    }
    const winners = evaluations
      .filter((e) => e.hand.rank === best.rank && e.hand.value === best.value)
      .map((e) => e.position)
    return { ...pot, winners, winAmount: Math.floor(pot.amount / winners.length) }
  })

  console.log(
    `      Winners per pot: ${evalResult.map((p) => 'P' + p.winners.join('&P')).join(', ')}`,
  )

  console.log(
    `      Winners per pot: ${evalResult.map((p) => 'P' + p.winners.join('&P')).join(', ')}`,
  )

  const players = awardPots(evalResult, game.players)

  const allWinners = new Set()
  evalResult.forEach((pot) => {
    if (pot.winners && pot.eligiblePlayers.length > 1) {
      pot.winners.forEach((pos) => allWinners.add(pos))
    }
  })

  return {
    ...game,
    status: 'completed',
    pot: 0,
    players: players.map((p) => ({ ...p, currentBet: 0, totalBet: 0 })),
    winners: Array.from(allWinners),
  }
}

function validateChipTotal(game, initialTotal) {
  const total = game.players.reduce((sum, p) => sum + p.chips, 0) + game.pot
  const expected = initialTotal
  if (total !== expected) {
    console.log(`      CHIP ERROR: expected ${expected}, got ${total}`)
    return false
  }
  return true
}

function playBettingRound(game) {
  let g = game
  while (!isBettingComplete(g) && g.currentPlayerPosition !== null) {
    const pos = g.currentPlayerPosition
    const player = g.players[pos]

    if (player.status !== 'active') {
      let nextPos = (pos + 1) % g.players.length
      let attempts = 0
      while (attempts < g.players.length) {
        if (g.players[nextPos].status === 'active') break
        nextPos = (nextPos + 1) % g.players.length
        attempts++
      }
      g = { ...g, currentPlayerPosition: nextPos }
      continue
    }

    const callAmount = g.currentBet - player.currentBet

    if (callAmount > 0 && player.chips > 0) {
      g = processAction(g, pos, 'call')
    } else if (callAmount === 0 && player.chips > 0) {
      g = processAction(g, pos, 'check')
    } else {
      break
    }
  }
  return g
}

function playHandWithAllIn(game) {
  let g = postBlinds(game)

  console.log(`    Hand ${g.handNumber}:`)
  console.log(
    `      P0: ${g.players[0].holeCards.map((c) => c.toString()).join(' ')} ($${g.players[0].chips})`,
  )
  console.log(
    `      P1: ${g.players[1].holeCards.map((c) => c.toString()).join(' ')} ($${g.players[1].chips})`,
  )
  console.log(
    `      Blinds: P0 SB=$[${g.players[0].currentBet}] P1 BB=$[${g.players[1].currentBet}], Pot: $${g.pot}`,
  )

  // Force all-in: Player with fewer chips goes all-in on their turn
  // The short stack is usually the BB in heads-up when dealer is 0
  // BB acts first preflop in heads-up
  const rounds = ['preflop', 'flop', 'turn', 'river']
  let forcedAllIn = false

  for (const round of rounds) {
    if (g.status === 'completed') break

    // On any round, if it's P0's turn and P1 is all-in, P0 calls
    if (
      g.currentPlayerPosition === 0 &&
      g.players[1].status === 'all_in' &&
      g.players[0].status === 'active'
    ) {
      const callAmount = g.currentBet - g.players[0].currentBet
      if (callAmount > 0 && g.players[0].chips > 0) {
        g = processAction(g, 0, 'call')
      }
    }

    // On any round, if it's P1's turn and P0 is all-in, P1 calls
    if (
      g.currentPlayerPosition === 1 &&
      g.players[0].status === 'all_in' &&
      g.players[1].status === 'active'
    ) {
      const callAmount = g.currentBet - g.players[1].currentBet
      if (callAmount > 0 && g.players[1].chips > 0) {
        g = processAction(g, 1, 'call')
      }
    }

    // Force the short stack (whoever has fewer chips) to go all-in on their first turn
    if (!forcedAllIn && g.currentPlayerPosition !== null) {
      const player = g.players[g.currentPlayerPosition]
      if (player.status === 'active' && player.chips > 0) {
        const opponentChips = g.players[1 - g.currentPlayerPosition].chips
        if (player.chips <= opponentChips && player.chips > 0) {
          const allInAmount = player.chips
          console.log(`      P${g.currentPlayerPosition} goes ALL-IN for $${allInAmount}`)
          g = processAction(g, g.currentPlayerPosition, 'bet', allInAmount)
          forcedAllIn = true
        }
      }
    }

    if (!isBettingComplete(g)) {
      g = playBettingRound(g)
    }

    console.log(
      `      After ${round}: Pot=$${g.pot}, P0=$[${g.players[0].chips}] totalBet=${g.players[0].totalBet}, P1=$[${g.players[1].chips}] totalBet=${g.players[1].totalBet}`,
    )

    // On any round, if it's P0's turn and P1 is all-in, P0 calls
    if (
      g.currentPlayerPosition === 0 &&
      g.players[1].status === 'all_in' &&
      g.players[0].status === 'active'
    ) {
      const callAmount = g.currentBet - g.players[0].currentBet
      if (callAmount > 0 && g.players[0].chips > 0) {
        console.log(
          `      P0 calls $${callAmount} (currentBet=${g.currentBet}, p0.currentBet=${g.players[0].currentBet})`,
        )
        g = processAction(g, 0, 'call')
        console.log(
          `      After call: P0 chips=${g.players[0].chips}, totalBet=${g.players[0].totalBet}`,
        )
      }
    }

    // On any round, if it's P1's turn and P0 is all-in, P1 calls
    if (
      g.currentPlayerPosition === 1 &&
      g.players[0].status === 'all_in' &&
      g.players[1].status === 'active'
    ) {
      const callAmount = g.currentBet - g.players[1].currentBet
      if (callAmount > 0 && g.players[1].chips > 0) {
        console.log(`      P1 calls $${callAmount}`)
        g = processAction(g, 1, 'call')
      }
    }

    // Force the short stack (whoever has fewer chips) to go all-in on their first turn
    if (!forcedAllIn && g.currentPlayerPosition !== null) {
      const player = g.players[g.currentPlayerPosition]
      if (player.status === 'active' && player.chips > 0) {
        const opponentChips = g.players[1 - g.currentPlayerPosition].chips
        if (player.chips <= opponentChips && player.chips > 0) {
          const allInAmount = player.chips
          console.log(
            `      P${g.currentPlayerPosition} goes ALL-IN for $${allInAmount} (has chips=${player.chips})`,
          )
          g = processAction(g, g.currentPlayerPosition, 'bet', allInAmount)
          console.log(
            `      After all-in: P${g.currentPlayerPosition} totalBet=${g.players[g.currentPlayerPosition].totalBet}`,
          )
          forcedAllIn = true
        }
      }
    }

    if (!isBettingComplete(g)) {
      g = playBettingRound(g)
    }

    if (g.currentRound === 'showdown' || isBettingComplete(g)) break

    // Check if we should advance to next round
    const active = g.players.filter((p) => p.status === 'active').length
    const canBet = g.players.filter((p) => p.status === 'active' && p.chips > 0).length

    if (active <= 1 && g.currentRound !== 'showdown') {
      g.currentRound = 'showdown'
    } else if (canBet === 0 && g.currentRound !== 'showdown') {
      g.currentRound = 'showdown'
    } else if (g.currentRound !== 'showdown' && isBettingComplete(g)) {
      g = advanceRound(g)
    }

    if (g.currentRound === 'showdown') break

    console.log(
      `      After ${round}: Pot=$${g.pot}, P0=$[${g.players[0].chips}] totalBet=${g.players[0].totalBet}, P1=$[${g.players[1].chips}] totalBet=${g.players[1].totalBet}`,
    )
  }

  // If betting ended before all community cards were dealt, deal them now
  if (g.communityCards.length < 5) {
    console.log(`      Dealing remaining community cards...`)
    while (g.communityCards.length < 5) {
      const needed = 5 - g.communityCards.length
      const dealCount = needed >= 3 ? 3 : needed
      g = dealCommunityCards(g, dealCount)
      if (g.communityCards.length >= 5) break
    }
  }

  if (g.status !== 'completed') {
    console.log(`      Showdown: ${g.communityCards.map((c) => c.toString()).join(' ')}`)
    g = processShowdown(g)
  }

  if (!validateChipTotal(g, STARTING_CHIPS + Math.floor(STARTING_CHIPS / 2))) {
    console.log(`      HAND FAILED CHIP VALIDATION`)
    return null
  }

  return g
}

console.log('=== All-in with Uneven Stacks Test ===')
console.log('Testing side pot handling with unequal chip stacks\n')

let allPassed = true
for (let test = 1; test <= 10; test++) {
  console.log(`\n--- Test ${test}/10 ---`)

  // Give P0 more chips, P1 fewer (uneven stacks)
  const initialTotal = STARTING_CHIPS + Math.floor(STARTING_CHIPS / 2)
  let game = createGame(STARTING_CHIPS, Math.floor(STARTING_CHIPS / 2))
  game.dealerPosition = 0

  const result = playHandWithAllIn(game)

  if (!result) {
    allPassed = false
    continue
  }

  const finalChips = result.players.reduce((sum, p) => sum + p.chips, 0)
  if (finalChips !== initialTotal) {
    console.log(`    FAILED: Total chips ${finalChips}, expected ${initialTotal}`)
    allPassed = false
  } else {
    console.log(`    PASSED: P0=$[${result.players[0].chips}] P1=$[${result.players[1].chips}]`)
  }
}

console.log('\n=== Summary ===')
console.log(allPassed ? 'All tests PASSED' : 'Some tests FAILED')
process.exit(allPassed ? 0 : 1)
