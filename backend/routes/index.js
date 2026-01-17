import express from 'express'
import gamesRouter from './games'
// @ts-ignore
const roomsRouter = require('./rooms')

const router = express.Router()

router.get('/health', function (req, res, next) {
  res.send({ health: 'OK' })
})

router.use('/games', gamesRouter)
router.use('/rooms', roomsRouter)

export default router
