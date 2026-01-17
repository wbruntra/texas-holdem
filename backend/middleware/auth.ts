// @ts-ignore
import db from '@holdem/database/db'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'sellingswam'

export function verifyToken(token: string): { playerId: number; gameId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { playerId: number; gameId: number }
    return decoded
  } catch (err) {
    return null
  }
}

export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return authHeader
}

export async function getRoomPlayerFromRequest(req: Request) {
  const authHeader = req.headers.authorization
  const token = extractToken(authHeader)

  if (token) {
    const player = await db('room_players').where({ session_token: token }).first()
    return player
  }
  return null
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const roomPlayer = await getRoomPlayerFromRequest(req)
    if (!roomPlayer) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    // Check connection
    if (!roomPlayer.connected) {
      // Optional: Auto-reconnect? For now just allow if token valid.
      // Or fail? Let's allow but maybe update stats.
    }

    // Attach roomPlayer to request
    // @ts-ignore
    req.roomPlayer = roomPlayer
    next()
  } catch (err) {
    next(err)
  }
}
