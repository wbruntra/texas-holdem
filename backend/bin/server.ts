import app from '../hono-app'
import bunWsService, { WebSocketData } from '../services/bun-websocket-service'
// @ts-ignore
import * as config from '@holdem/shared/config'

console.log(`Hono Backend will run on port: ${config.BACKEND_LOCAL_PORT || 3000}`)

const port = process.env.PORT || config.BACKEND_LOCAL_PORT || 3000

const server = Bun.serve<WebSocketData>({
  port: port,
  fetch(req, server) {
    if (
      server.upgrade(req, {
        data: {
          // Initial data structure for WebSocket
        },
      })
    ) {
      return undefined
    }
    return app.fetch(req, server)
  },
  websocket: {
    open(ws) {
      bunWsService.open(ws)
    },
    message(ws, message) {
      bunWsService.message(ws, message)
    },
    close(ws, code, message) {
      bunWsService.close(ws)
    },
    drain(ws) {
      bunWsService.drain(ws)
    },
  },
})

console.log(`Listening on http://localhost:${server.port}`)
