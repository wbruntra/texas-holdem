#!/usr/bin/env bun

/**
 * Simple 2-Player Texas Hold'em Simulation
 * Demonstrates the basic game flow: blinds, betting rounds, showdown
 */

const { shuffleDeck, createDeck, dealHoleCards } = require('./backend/lib/poker-engine')
const { calculatePots, awardPots } = require('./backend/lib/pot-manager')
const { evaluateHand } = require('./backend/lib/poker-engine')

const SMALL_BLIND = 5
const BIG_BLIND = 10
const STARTING_CHIPS = 400

function createGame(players) {
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
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      position: i,
      chips: p.chips ?? STARTING_CHIPS,
      currentBet: 0,
      totalBet: 0,
      holeCards: [],
      status: 'active',
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      lastAction: null,
    })),
  }
}

function dealCommunityCards(game, count) {
  const deck = game.deck
  const cards = deck.slice(1, 1 + count)
  return {
    ...game,
    deck: deck.slice(1 + count),
    communityCards: [...game.communityCards, ...cards],
  }
}

function postBlinds(game) {
  const players = game.players.map((p) => ({
    ...p,
    currentBet: 0,
    totalBet: 0,
    status: p.chips > 0 ? p.status : 'out',
  }))

  const activePlayers = players.filter((p) => p.status === 'active')
  if (activePlayers.length < 2) {
    return {
      ...game,
      status: 'completed',
      players,
    }
  }

  const isHeadsUp = activePlayers.length === 2
  const dealerPos = game.dealerPosition

  const sbPos = isHeadsUp ? dealerPos : (dealerPos + 1) % players.length
  const bbPos = isHeadsUp ? (sbPos + 1) % players.length : (sbPos + 1) % players.length

  if (players[sbPos].status !== 'active' || players[bbPos].status !== 'active') {
    return {
      ...game,
      status: 'completed',
      players,
    }
  }

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

  const pot = sbAmount + bbAmount
  const currentBet = bbAmount

  const deck = shuffleDeck(createDeck())
  const dealResult = dealHoleCards(deck, 2)
  const playersToDeal = players.filter((p) => p.status === 'active')
  playersToDeal.forEach((p, i) => {
    const player = players.find((pl) => pl.position === p.position)
    player.holeCards = dealResult.players[i]
  })

  const firstToAct = isHeadsUp ? bbPos : (bbPos + 1) % players.length

  return {
    ...game,
    status: 'active',
    currentRound: 'preflop',
    pot,
    currentBet,
    lastRaise: 0,
    deck: dealResult.deck,
    handNumber: game.handNumber + 1,
    communityCards: [],
    players,
    currentPlayerPosition: firstToAct,
  }
}

function getValidActions(game, playerPos) {
  const player = game.players[playerPos]
  if (game.currentPlayerPosition !== playerPos) return { canAct: false }
  if (player.status !== 'active') return { canAct: false }

  const callAmount = game.currentBet - player.currentBet
  return {
    canAct: true,
    canCheck: callAmount === 0,
    canCall: callAmount > 0 && player.chips > 0,
    canBet: game.currentBet === 0 && player.chips >= BIG_BLIND,
    canRaise: game.currentBet > 0 && player.chips >= callAmount + game.lastRaise,
    canFold: true,
    callAmount,
    minRaise: game.lastRaise,
    maxRaise: player.chips - callAmount,
  }
}

function processAction(game, playerPos, action, amount = 0) {
  const actions = getValidActions(game, playerPos)

  if (!actions.canAct) throw new Error('Player cannot act')
  if (action === 'check' && !actions.canCheck) throw new Error('Cannot check')
  if (action === 'call' && !actions.canCall) throw new Error('Cannot call')
  if (action === 'bet' && !actions.canBet) throw new Error('Cannot bet')
  if (action === 'raise' && !actions.canRaise) throw new Error('Cannot raise')
  if (action === 'fold' && !actions.canFold) throw new Error('Cannot fold')

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
      const callAmt = Math.min(actions.callAmount, p.chips)
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
      newCurrentBet = actualAmount
      newLastRaise = actualAmount
      p.lastAction = 'bet'
      if (p.chips === 0) p.status = 'all_in'
      break
    }

    case 'raise': {
      const totalBet = Math.min(actions.callAmount + amount, p.chips)
      p.chips -= totalBet
      p.currentBet += totalBet
      p.totalBet += totalBet
      newPot += totalBet
      newCurrentBet = p.currentBet
      newLastRaise = amount
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

  const activePlayers = players.filter((pl) => pl.status === 'active')
  const foldedPlayers = players.filter((pl) => pl.status === 'folded')
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
    if (players[nextPos].status === 'active') {
      break
    }
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

    let firstToAct = null
    if (newRound !== 'showdown') {
      let pos = (game.dealerPosition + 1) % players.length
      let attempts = 0
      while (attempts < players.length) {
        if (players[pos].status === 'active') {
          firstToAct = pos
          break
        }
        pos = (pos + 1) % players.length
        attempts++
      }
    }

    return {
      ...game,
      currentRound: newRound,
      communityCards: result ? result.communityCards : game.communityCards,
      deck: result ? result.deck : game.deck,
      players,
      currentBet: 0,
      lastRaise: 0,
      currentPlayerPosition: firstToAct,
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
      status: players.filter((p) => p.chips > 0).length <= 1 ? 'completed' : game.status,
      pot: 0,
      players: players.map((p) => ({ ...p, currentBet: 0, totalBet: 0 })),
      winners: [winner.position],
    }
  }

  const pots = calculatePots(game.players)

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
      if (e.hand.rank > best.rank) best = e.hand
    }
    const winners = evaluations.filter((e) => e.hand.rank === best.rank).map((e) => e.position)
    return { ...pot, winners, winAmount: Math.floor(pot.amount / winners.length) }
  })

  const players = awardPots(evalResult, game.players)

  const allWinners = new Set()
  evalResult.forEach((pot) => {
    if (pot.winners && pot.eligiblePlayers.length > 1) {
      pot.winners.forEach((pos) => allWinners.add(pos))
    }
  })

  return {
    ...game,
    status: players.filter((p) => p.chips > 0).length <= 1 ? 'completed' : game.status,
    pot: 0,
    players: players.map((p) => ({ ...p, currentBet: 0, totalBet: 0 })),
    winners: Array.from(allWinners),
  }
}

function validateChipTotal(game) {
  const total = game.players.reduce((sum, p) => sum + p.chips, 0) + game.pot
  const expected = STARTING_CHIPS * 2
  if (total !== expected) {
    console.log(`  CHIP ERROR: expected ${expected}, got ${total}`)
    return false
  }
  return true
}

function bot1DecideAction(game, playerPos) {
  const actions = getValidActions(game, playerPos)
  if (!actions.canAct) return null
  const betAmount = Math.max(10, Math.floor(game.players[playerPos].chips * 0.1))
  if (actions.canBet) return { action: 'bet', amount: betAmount }
  if (actions.canRaise) return { action: 'raise', amount: betAmount }
  if (actions.canCall) return { action: 'call' }
  if (actions.canCheck) return { action: 'check' }
  return { action: 'fold' }
}

function bot2DecideAction(game, playerPos) {
  const actions = getValidActions(game, playerPos)
  if (!actions.canAct) return null
  if (actions.canCall) return { action: 'call' }
  if (actions.canCheck) return { action: 'check' }
  return { action: 'fold' }
}

function playBettingRound(game, bot1, bot2) {
  let g = game
  while (!isBettingComplete(g) && g.currentPlayerPosition !== null) {
    const pos = g.currentPlayerPosition
    const decision = pos === 0 ? bot1(g, pos) : bot2(g, pos)
    if (!decision) break
    g = processAction(g, pos, decision.action, decision.amount || 0)
  }
  return g
}

function playHand(game, bot1, bot2) {
  let g = postBlinds(game)
  console.log(
    `  Hand ${g.handNumber}: P0=$${g.players[0].chips} P1=$${g.players[1].chips} Pot=$${g.pot} (${g.currentRound})`,
  )

  const rounds = ['preflop', 'flop', 'turn', 'river']
  for (const round of rounds) {
    if (g.status === 'completed') break
    g = playBettingRound(g, bot1, bot2)

    console.log(
      `  After ${round}: P0 chips=${g.players[0].chips} totalBet=${g.players[0].totalBet} | P1 chips=${g.players[1].chips} totalBet=${g.players[1].totalBet} | Pot=${g.pot}`,
    )

    const active = g.players.filter((p) => p.status === 'active').length
    const canBet = g.players.filter((p) => p.status === 'active' && p.chips > 0).length

    if (active <= 1 && g.currentRound !== 'showdown') {
      g.currentRound = 'showdown'
      break
    }

    if (canBet === 0 && g.currentRound !== 'showdown') {
      g.currentRound = 'showdown'
      break
    }

    if (round !== 'river') {
      g = advanceRound(g)
    }
  }

  if (g.currentRound === 'river' || isBettingComplete(g)) {
    g.currentRound = 'showdown'
    console.log(
      `  Before showdown: P0 chips=${g.players[0].chips} totalBet=${g.players[0].totalBet} | P1 chips=${g.players[1].chips} totalBet=${g.players[1].totalBet} | Pot=${g.pot}`,
    )
    g = processShowdown(g)
    console.log(
      `  Showdown result: P0=$${g.players[0].chips} P1=$${g.players[1].chips} Pot=$${g.pot} Winners: P${g.winners[0] ?? 'none'}`,
    )
  }

  if (!validateChipTotal(g)) {
    process.exit(1)
  }

  return g
}

console.log("=== 2-Player Texas Hold'em Simulation ===")
console.log(`Starting chips: $${STARTING_CHIPS} each\n`)

let game = createGame([
  { id: '1', name: 'Aggressive Bot' },
  { id: '2', name: 'Calling Bot' },
])

let hand = 0
while (game.status !== 'completed' && hand < 30) {
  hand++
  game = playHand(game, bot1DecideAction, bot2DecideAction)

  const active = game.players.filter((p) => p.chips > 0)
  if (active.length <= 1) {
    game.status = 'completed'
    break
  }
}

console.log(`\n=== Game Over after ${hand} hands ===`)
console.log(`Final: P0=$${game.players[0].chips} P1=$${game.players[1].chips}`)
console.log(`Winner: P${game.winners[0] ?? '?'}`)
