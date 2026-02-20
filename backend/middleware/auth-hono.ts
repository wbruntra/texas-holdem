import { Context, Next } from 'hono'
import { verify } from 'jsonwebtoken'
// @ts-ignore
import db from '@holdem/database/db'

const JWT_SECRET = process.env.JWT_SECRET || 'sellingswam'

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const decoded = verify(token, JWT_SECRET) as { playerId: number }
    if (!decoded || !decoded.playerId) {
      throw new Error('Invalid token')
    }

    const player = await db('room_players').where({ id: decoded.playerId }).first()

    if (!player) {
      return c.json({ error: 'Player not found' }, 401)
    }

    // Attach player to context
    c.set('player', player)

    await next()
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401)
  }
}
