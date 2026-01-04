const db = require('./db').default

const run = async () => {
  const showdown_history = await db('showdown_history').select('*')
  console.log('Showdown History Data:', showdown_history)
}

run().then(() => {
  db.destroy()
})
