var express = require('express')
var router = express.Router()

/* GET home page. */
router.get('/health', function (req, res, next) {
  res.send({ health: 'OK' })
})

router.get('/hello', function (req, res, next) {
  res.send({ message: 'Hello, world!' })
})

module.exports = router
