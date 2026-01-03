import express from 'express'
import gamesRouter from './games'

const router = express.Router()

router.get('/health', function (req, res, next) {
  res.send({ health: 'OK' })
})

router.use('/games', gamesRouter)

export default router
