#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path')
const knexFactory = require('knex')

function parseArgs(argv) {
  const args = {
    dbFile: null,
    gameId: null,
    roomCode: null,
    handNumber: null,
    json: false,
  }

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]

    if (token === '--db') {
      args.dbFile = argv[++i]
      continue
    }

    if (token === '--game' || token === '--gameId') {
      args.gameId = argv[++i]
      continue
    }

    if (token === '--room' || token === '--roomCode') {
      args.roomCode = argv[++i]
      continue
    }

    if (token === '--hand' || token === '--handNumber') {
      const raw = argv[++i]
      args.handNumber = raw === undefined ? null : Number(raw)
      continue
    }

    if (token === '--json') {
      args.json = true
      continue
    }

    if (token === '-h' || token === '--help') {
      args.help = true
      continue
    }

    // Allow positional shorthand: dump-game.js <roomCode>
    if (!args.roomCode && !args.gameId && !token.startsWith('-')) {
      args.roomCode = token
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

function parseJsonMaybe(value) {
  if (value === null || value === undefined) return value
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function usage(exitCode = 0) {
  const text = `\
Usage:
  node debug/dump-game.js --room ABC123 [--db /path/to/holdem.sqlite3] [--hand 12] [--json]
  node debug/dump-game.js --game <game-id> [--db /path/to/holdem.sqlite3] [--hand 12] [--json]
  node debug/dump-game.js ABC123 [--db /path/to/holdem.sqlite3]

Notes:
  - If --db is omitted, defaults to ./holdem.sqlite3 in this repo.
  - If --hand is omitted, dumps all hands for the game.
  - Action history is stored in actions+hands. If hands were never created, there may be no actions.
`
  console.log(text)
  process.exit(exitCode)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) usage(0)

  if (!args.gameId && !args.roomCode) {
    console.error('Error: must pass --room <code> or --game <id> (or positional roomCode).')
    usage(2)
  }

  const dbFile = args.dbFile
    ? path.resolve(args.dbFile)
    : path.join(__dirname, '..', 'holdem.sqlite3')

  const knex = knexFactory({
    client: 'sqlite3',
    connection: { filename: dbFile },
    useNullAsDefault: true,
  })

  try {
    const gameRow = args.gameId
      ? await knex('games').where({ id: args.gameId }).first()
      : await knex('games').where({ room_code: args.roomCode }).first()

    if (!gameRow) {
      throw new Error(
        args.gameId
          ? `Game not found for id=${args.gameId}`
          : `Game not found for room_code=${args.roomCode}`,
      )
    }

    const gameId = gameRow.id

    const playersRows = await knex('players').where({ game_id: gameId }).orderBy('position', 'asc')

    let handsQuery = knex('hands').where({ game_id: gameId }).orderBy('hand_number', 'asc')
    if (Number.isFinite(args.handNumber)) {
      handsQuery = handsQuery.andWhere({ hand_number: args.handNumber })
    }
    const handsRows = await handsQuery

    const actionsRows = await knex('actions')
      .join('hands', 'actions.hand_id', 'hands.id')
      .where('hands.game_id', gameId)
      .modify((qb) => {
        if (Number.isFinite(args.handNumber)) {
          qb.andWhere('hands.hand_number', args.handNumber)
        }
      })
      .select(
        'actions.id as id',
        'actions.hand_id as hand_id',
        'hands.hand_number as hand_number',
        'actions.player_id as player_id',
        'actions.action_type as action_type',
        'actions.amount as amount',
        'actions.round as round',
        'actions.created_at as created_at',
      )
      .orderBy([
        { column: 'hands.hand_number', order: 'asc' },
        { column: 'actions.created_at', order: 'asc' },
      ])

    const playersById = new Map(playersRows.map((p) => [p.id, p]))

    const game = {
      ...gameRow,
      community_cards: parseJsonMaybe(gameRow.community_cards),
      deck: parseJsonMaybe(gameRow.deck),
      winners: parseJsonMaybe(gameRow.winners),
      pots: parseJsonMaybe(gameRow.pots),
      total_bet: parseJsonMaybe(gameRow.total_bet),
    }

    const players = playersRows.map((p) => ({
      ...p,
      hole_cards: parseJsonMaybe(p.hole_cards),
    }))

    const hands = handsRows.map((h) => ({
      ...h,
      winners: parseJsonMaybe(h.winners),
      community_cards: parseJsonMaybe(h.community_cards),
    }))

    const actions = actionsRows.map((a) => {
      const p = playersById.get(a.player_id)
      return {
        ...a,
        player_name: p ? p.name : null,
        player_position: p ? p.position : null,
      }
    })

    const output = {
      meta: {
        generated_at: new Date().toISOString(),
        db_file: dbFile,
      },
      game,
      players,
      hands,
      actions,
      warnings: [],
    }

    if (hands.length === 0) {
      output.warnings.push(
        'No hands rows found for this game. If your server only creates hands at showdown, action history may be missing.',
      )
    }

    if (actions.length === 0) {
      output.warnings.push(
        'No actions rows found (via actions→hands join). If hands were not created, actions will not be recorded.',
      )
    }

    if (args.json) {
      process.stdout.write(JSON.stringify(output, null, 2) + '\n')
      return
    }

    // Human-readable output
    console.log(`DB: ${dbFile}`)
    console.log(`Game: id=${game.id} room_code=${game.room_code} status=${game.status}`)
    console.log(
      `State: round=${game.current_round} hand_number=${game.hand_number} current_player_position=${game.current_player_position} current_bet=${game.current_bet} last_raise=${game.last_raise} pot=${game.pot}`,
    )

    console.log('Players:')
    for (const p of players) {
      console.log(
        `  pos=${p.position} name=${p.name} id=${p.id} status=${p.status} chips=${p.chips} current_bet=${p.current_bet} total_bet=${p.total_bet} last_action=${p.last_action}`,
      )
    }

    console.log('Hands:')
    for (const h of hands) {
      console.log(
        `  hand_number=${h.hand_number} id=${h.id} pot_amount=${h.pot_amount} completed_at=${h.completed_at || ''}`,
      )
    }

    console.log('Actions:')
    for (const a of actions) {
      console.log(
        `  hand=${a.hand_number} ${a.created_at} round=${a.round} pos=${a.player_position} name=${a.player_name} action=${a.action_type} amount=${a.amount}`,
      )
    }

    if (output.warnings.length > 0) {
      console.log('Warnings:')
      for (const w of output.warnings) console.log(`  - ${w}`)
    }
  } finally {
    await knex.destroy()
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
