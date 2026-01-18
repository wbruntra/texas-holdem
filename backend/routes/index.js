import express from 'express'
import gamesRouter from './games'
import adminRouter from './admin'
// @ts-ignore
const roomsRouter = require('./rooms')

const router = express.Router()

router.get('/health', function (req, res, next) {
  res.send({ health: 'OK' })
})

router.use('/games', gamesRouter)
router.use('/rooms', roomsRouter)
router.use('/admin', adminRouter)

export default router
