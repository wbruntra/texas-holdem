const db = require('./db').default

const run = async () => {
  const showdown_history = await db('showdown_history').select('*').orderBy('id', 'desc').first()

  console.log('Showdown History Record:', showdown_history)
  // console.log('Showdown History Data:', JSON.parse(showdown_history.community_cards))
}

run().then(() => {
  db.destroy()
})
