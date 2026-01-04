#!/usr/bin/env bun
const jwt = require('jsonwebtoken')
const db = require('../database/db').default
const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const { resolve } = require('path')

// function loadEnv() {
//   const envPath = resolve(__dirname, '.env')
//   try {
//     const content = readFileSync(envPath, 'utf-8')
//     content.split('\n').forEach((line) => {
//       const [key, ...valueParts] = line.split('=')
//       if (key && valueParts.length > 0) {
//         const value = valueParts.join('=').trim()
//         process.env[key] = value
//       }
//     })
//   } catch (err) {
//     // .env file not found, continue with defaults
//   }
// }

// loadEnv()

const JWT_SECRET = process.env.JWT_SECRET
console.log(JWT_SECRET)

function generateToken(playerId, gameId) {
  return jwt.sign({ playerId, gameId }, JWT_SECRET, { expiresIn: '7d' })
}

async function main() {
  const playerId = parseInt(process.argv[2])
  const apiRoute = process.argv[3]

  if (!playerId || !apiRoute) {
    console.log('Usage: bun api-debug.js [PLAYER_ID] [API_ROUTE]')
    console.log('')
    console.log('Examples:')
    console.log('  bun api-debug.js 10 /api/games/8/actions/valid')
    console.log('  bun api-debug.js 10 /api/games/room/PESBUA/state | jq')
    console.log('')
    console.log('To find player IDs:')
    console.log(
      '  node -e "const db=require(`./database/db`); db(`players`).select(`id`,`name`,`game_id`).then(p=>{p.forEach(v=>console.log(`${v.id}: ${v.name} (game ${v.game_id})`));db.destroy()})"',
    )
    process.exit(1)
  }

  const player = await db('players').where({ id: playerId }).first()

  if (!player) {
    console.log(`Player not found: ${playerId}`)
    await db.destroy()
    process.exit(1)
  }

  const token = generateToken(player.id, player.game_id)

  const baseUrl = 'http://localhost:3660'
  let url = apiRoute

  if (!url.startsWith('/')) {
    url = `/api/${url}`
  }

  const fullUrl = `${baseUrl}${url}`
  const cmd = `curl -s -H "Authorization: Bearer ${token}" "${fullUrl}"`

  console.log(`Player: ${player.name} (ID: ${player.id}, Game: ${player.game_id})`)
  console.log(`$ ${cmd}`)
  console.log('')

  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] })
    console.log(result)
  } catch (err) {
    console.log(err.stdout || err.stderr || err.message)
  }

  await db.destroy()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
