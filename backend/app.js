var createError = require('http-errors')
var express = require('express')
const cookieSession = require('cookie-session')
var logger = require('morgan')

var indexRouter = require('./routes/index')

var app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use(
  cookieSession({
    name: 'holdem',
    keys: ['hackedescape'],
  }),
)

app.use('/api', indexRouter)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  const statusCode = err.status || 500

  if (req.app.get('env') === 'development') {
    // Send detailed error information in development
    res.status(statusCode).json({
      error: {
        message: err.message,
        status: statusCode,
        stack: err.stack,
        name: err.name,
        ...(err.errors && { errors: err.errors }), // For validation errors
        ...(err.code && { code: err.code }),
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    })
  } else {
    // Send generic error message in production
    res.status(statusCode).json({
      error: {
        message: err.message || 'Internal Server Error',
        status: statusCode,
        timestamp: new Date().toISOString()
      }
    })
  }
})

module.exports = app
