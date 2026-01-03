import knex from 'knex'
import * as config from './knexfile.js'

const env = process.env.NODE_ENV || 'development'

const db = knex(config[env])

export default db
