import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'
import { HTTPException } from 'hono/http-exception'
import apiRoutes from './routes/index.hono'
import customLogger from './middleware/customLogger'

const app = new Hono()
const isDevelopment = process.env.NODE_ENV === 'development'

// Middleware
app.use('*', customLogger)
app.use('*', cors())
app.use('*', prettyJSON())
// Health Check
app.get('/api/health', (c) => c.json({ health: 'OK' }))

// API Routes
app.route('/api', apiRoutes)

app.notFound((c) => {
  const errorObj: Record<string, unknown> = {
    error: {
      message: 'Not Found',
      status: 404,
    },
  }

  if (isDevelopment) {
    errorObj.error = {
      ...errorObj.error,
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString(),
    }
  }

  return c.json(errorObj, 404)
})

// Error Handling
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (err.status >= 500) console.error('Hono App Error:', err)
    return err.getResponse()
  }
  console.error('Hono App Error:', err)

  const errorObj: Record<string, unknown> = {
    error: {
      message: err.message || 'Internal Server Error',
      status: 500,
    },
  }

  if (isDevelopment) {
    errorObj.error = {
      ...errorObj.error,
      name: err.name,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString(),
    }
  }

  return c.json(errorObj, 500)
})

export default app
