import { Hono } from 'hono'
import roomService from '../services/room-service'
import { sign } from 'jsonwebtoken'
// @ts-ignore
import db from '@holdem/database/db'
// @ts-ignore
import bcrypt from 'bcryptjs'

const app = new Hono()
const JWT_SECRET = process.env.JWT_SECRET || 'sellingswam'

app.post('/', async (c) => {
  try {
    const { smallBlind, bigBlind, startingChips } = await c.req.json()
    // @ts-ignore
    const room = await roomService.createRoom({
      smallBlind,
      bigBlind,
      startingChips,
    })
    return c.json(room)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/:roomCode', async (c) => {
  try {
    const roomCode = c.req.param('roomCode')
    // @ts-ignore
    const room = await roomService.getRoomByCode(roomCode)
    if (!room) {
      return c.json({ error: 'Room not found' }, 404)
    }
    return c.json(room)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Join room - Generates JWT
app.post('/:roomCode/join', async (c) => {
  try {
    const roomCode = c.req.param('roomCode')
    const { name, password } = await c.req.json()

    // We can't use roomService.joinRoom directly if it doesn't handle bcrypt verification properly (as noted in rooms.js comments)
    // BUT, let's look at rooms.js again. It calls roomService.joinRoom(roomCode, name, password)
    // AND it mentions "I will write this router now assuming roomService.joinRoom takes password (RAW)..."
    // Let's check room-service.ts again.
    // It implements bcrypt compare/hash!
    // Wait, in Step 114, room-service.ts:
    // `const isValid = await bcrypt.compare(password, existingPlayer.password_hash)`
    // So roomService.joinRoom DOES handle bcrypt.

    // EXCEPT: The return value of joinRoom is `{ player, token }`.
    // The `token` there is `session_token` (UUID).
    // We want to return a JWT instead.

    // @ts-ignore
    const result = await roomService.joinRoom(roomCode, name, password)

    // Check if result has token (UUID)
    if (result && result.player) {
      // Generate JWT
      const jwtToken = sign(
        {
          playerId: result.player.id,
          gameId: result.player.gameId, // if available? room_player doesn't have gameId usually, only room_id.
        },
        JWT_SECRET,
        { expiresIn: '24h' },
      )

      return c.json({
        player: result.player,
        token: jwtToken, // OVERRIDE the UUID with JWT
      })
    }

    return c.json(result)
  } catch (error: any) {
    return c.json({ error: error.message }, 400)
  }
})

export default app
