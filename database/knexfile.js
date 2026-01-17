// Update with your config settings.
const path = require('path')

const commonConfig = {
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, 'holdem.sqlite3'),
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
  },
}

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
const config = {
  development: {
    ...commonConfig,
  },
  staging: {
    ...commonConfig,
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
