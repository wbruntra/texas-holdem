const knex = require('knex')

const config = require('./knexfile').test

module.exports = knex(config)
