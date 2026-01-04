process.env.NODE_ENV = 'test'

const { describe, it, expect, beforeAll, afterAll } = require('bun:test')

const dbModule = require('@holdem/database/db')
const db = dbModule.default || dbModule

const gameService = require('./services/game-service')
const playerService = require('./services/player-service')
const actionService = require('./services/action-service')

const { ROUND } = require('./lib/game-constants')

async function resetAllTables() {
  await db('actions').delete()
  await db('hands').delete()
  await db('players').delete()
  await db('games').delete()
}

beforeAll(async () => {
  await db.migrate.latest()
  await resetAllTables()
})

afterAll(async () => {
  await resetAllTables()
  await db.destroy()
})

async function createHeadsUpGame(startingChips = 500) {
  const game = await gameService.createGame({ smallBlind: 10, bigBlind: 20, startingChips })
  const sb = await playerService.joinGame(game.id, 'PlayerA', 'passA')
  const bb = await playerService.joinGame(game.id, 'PlayerB', 'passB')
  await gameService.startGame(game.id)
  return { gameId: game.id, sb, bb }
}

describe('all-in runout / action_finished', () => {
  it('sets action_finished after all-in is called and betting is complete', async () => {
    const { gameId, sb, bb } = await createHeadsUpGame(500)

    // Preflop: SB calls, BB goes all-in, SB calls
    await actionService.submitAction(sb.id, 'call', 0)
    await actionService.submitAction(bb.id, 'all_in', 0)
    await actionService.submitAction(sb.id, 'call', 0)

    const state = await gameService.getGameById(gameId)
    expect(state.currentRound).toBe(ROUND.PREFLOP)
    expect(state.currentPlayerPosition).toBe(null)
    expect(state.action_finished).toBe(true)

    const sbActions = await actionService.getPlayerValidActions(sb.id)
    const bbActions = await actionService.getPlayerValidActions(bb.id)

    expect(sbActions.canAdvance).toBe(true)
    expect(bbActions.canAdvance).toBe(true)
  })

  it('prevents betting actions while action_finished is true', async () => {
    const { gameId, sb, bb } = await createHeadsUpGame(500)

    await actionService.submitAction(sb.id, 'call', 0)
    await actionService.submitAction(bb.id, 'all_in', 0)
    await actionService.submitAction(sb.id, 'call', 0)

    const state = await gameService.getGameById(gameId)
    expect(state.action_finished).toBe(true)

    await expect(actionService.submitAction(sb.id, 'check', 0)).rejects.toThrow(
      'Board must be advanced before actions',
    )
  })

  it('allows manual advancing through flop/turn/river to showdown in action_finished mode', async () => {
    const { gameId, sb, bb } = await createHeadsUpGame(500)

    await actionService.submitAction(sb.id, 'call', 0)
    await actionService.submitAction(bb.id, 'all_in', 0)
    await actionService.submitAction(sb.id, 'call', 0)

    let state = await gameService.getGameById(gameId)
    expect(state.action_finished).toBe(true)

    state = await gameService.advanceOneRound(gameId)
    expect(state.currentRound).toBe(ROUND.FLOP)

    state = await gameService.advanceOneRound(gameId)
    expect(state.currentRound).toBe(ROUND.TURN)

    state = await gameService.advanceOneRound(gameId)
    expect(state.currentRound).toBe(ROUND.RIVER)

    state = await gameService.advanceOneRound(gameId)
    expect(state.currentRound).toBe(ROUND.SHOWDOWN)
  })
})
