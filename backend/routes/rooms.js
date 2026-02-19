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

    const result = await roomService.joinRoom(roomCode, name, password)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

module.exports = router
