const express = require('express')
const router = express.Router()
const roomService = require('../services/room-service').default
const gameService = require('../services/game-service').default

// Create new room
router.post('/', async (req, res, next) => {
  try {
    const { smallBlind, bigBlind, startingChips } = req.body
    const room = await roomService.createRoom({
      smallBlind,
      bigBlind,
      startingChips,
    })
    res.json(room)
  } catch (error) {
    next(error)
  }
})

// Get room by code
router.get('/:roomCode', async (req, res, next) => {
  try {
    const { roomCode } = req.params
    const room = await roomService.getRoomByCode(roomCode)
    if (!room) {
      return res.status(404).json({ error: 'Room not found' })
    }
    res.json(room)
  } catch (error) {
    next(error)
  }
})

// Join room
router.post('/:roomCode/join', async (req, res, next) => {
  try {
    const { roomCode } = req.params
    const { name, password } = req.body

    // Hash password here or in service? Service does checking, verify if it hashes.
    // room-service `joinRoom` expects `passwordHash`.
    // Wait, the service was: `joinRoom(roomCode, name, passwordHash)`.
    // The previous implementation hashed in the route or service?
    // In `player-service` it hashed inside `joinGame`.
    // In `room-service.ts` I wrote: `if (existingPlayer.password_hash !== passwordHash)`.
    // So the service expects the HASH or the RAW password?
    // Let's check `room-service.ts`.
    // It says: `const [playerId] = await db('room_players').insert({ ... password_hash: passwordHash ... })`
    // So it expects the hash.
    // So the ROUTE should hash the password before calling service?
    // Or simpler: change service to take raw password and hash it.
    // I prefer service handling hashing to keep routes clean.
    // But let's check what I implemented in room-service.ts.
    // I implemented: `if (existingPlayer.password_hash !== passwordHash)` -> Plain equality.
    // This implies `passwordHash` param IS the hash? Or assumes plain text stored?
    // Security-wise we should hash.
    // Let's UPDATE room-service to take raw password and use bcrypt.
    // I will do that in a follow-up action to room-service.ts.
    // For now, I'll assume the service handles it or I hash here.
    // Let's use bcrypt here if needed.
    // Actually, `room-service.ts` I wrote: `const passwordHash = passwordHash`... wait.

    // Let's check `room-service.ts` content I wrote in Step 108.
    // `joinRoom` signature: `(roomCode, name, passwordHash)`
    // logic: `if (existingPlayer.password_hash !== passwordHash)`
    // logic new: `insert({ ... password_hash: passwordHash })`
    // This means I expected the CALLER to provide the hash.
    // So I need to hash here.

    const bcrypt = require('bcryptjs')
    // We should use verify logic inside service potentially, but consistency with `joinGame` (old) required check.
    // Old `player-service` did `bcrypt.compare`.
    // My new `room-service` does simple string comparison! That is insecure if input is raw.
    // If input is hash, it's comparing hash to hash? That's also wrong (salt).
    // I need to fix `room-service.ts` to properly handle bcrypt.

    // FIX PLAN:
    // I will write this router now assuming `roomService.joinRoom` takes `password` (RAW) and handles it.
    // Then I will REWRITE `room-service.ts` to handle bcrypt properly.

    const result = await roomService.joinRoom(roomCode, name, password)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

module.exports = router
