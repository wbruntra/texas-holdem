import { Hono } from 'hono'
import games from './games.hono'
import rooms from './rooms.hono'
import admin from './admin.hono'

const app = new Hono()

app.route('/games', games)
app.route('/rooms', rooms)
app.route('/admin', admin)

export default app
