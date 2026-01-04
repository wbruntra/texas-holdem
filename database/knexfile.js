// Update with your config settings.
const path = require('path')

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
const config = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'holdem.sqlite3'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
    },
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'holdem-test.sqlite3'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
    },
  },
}

module.exports = config
