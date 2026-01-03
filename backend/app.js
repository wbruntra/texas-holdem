import createError from 'http-errors'
import express from 'express'
import cookieSession from 'cookie-session'
import logger from 'morgan'

import indexRouter from './routes/index'

const app = express()

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

app.use(function (req, res, next) {
  next(createError(404))
})

app.use(function (err, req, res, next) {
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  const statusCode = err.status || 500

  if (req.app.get('env') === 'development') {
    const errorDetails = {
      message: err.message,
      status: statusCode,
      stack: err.stack,
      name: err.name,
      ...(err.errors && { errors: err.errors }),
      ...(err.code && { code: err.code }),
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    }

    console.log('Error details:', errorDetails)

    res.status(statusCode).json({
      error: errorDetails,
    })
  } else {
    res.status(statusCode).json({
      error: {
        message: err.message || 'Internal Server Error',
        status: statusCode,
        timestamp: new Date().toISOString(),
      },
    })
  }
})

export default app
