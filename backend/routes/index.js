var express = require('express');
var router = express.Router();
var gamesRouter = require('./games');

/* Health check */
router.get('/health', function (req, res, next) {
  res.send({ health: 'OK' });
});

/* Game routes */
router.use('/games', gamesRouter);

module.exports = router;
