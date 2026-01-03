const { describe, it, expect } = require('bun:test')
const { shuffleDeck, createDeck } = require('./poker-engine')

function cardsEqual(c1, c2) {
  return c1.rank === c2.rank && c1.suit === c2.suit
}

function decksEqual(d1, d2) {
  if (d1.length !== d2.length) return false
  return d1.every((c, i) => cardsEqual(c, d2[i]))
}

describe('shuffleDeck', () => {
  it('shuffles deck with no seed', () => {
    const deck = createDeck()
    const shuffled = shuffleDeck(deck)

    expect(shuffled).toHaveLength(52)
    expect(decksEqual(shuffled, deck)).toBe(false)
  })

  it('produces same result with same seed', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()
    const seed = 'test-seed-123'

    const shuffled1 = shuffleDeck(deck1, seed)
    const shuffled2 = shuffleDeck(deck2, seed)

    expect(decksEqual(shuffled1, shuffled2)).toBe(true)
  })

  it('produces different results with different seeds', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()

    const shuffled1 = shuffleDeck(deck1, 'seed-one')
    const shuffled2 = shuffleDeck(deck2, 'seed-two')

    expect(decksEqual(shuffled1, shuffled2)).toBe(false)
  })

  it('produces different results with numeric seeds', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()

    const shuffled1 = shuffleDeck(deck1, 12345)
    const shuffled2 = shuffleDeck(deck2, 67890)

    expect(decksEqual(shuffled1, shuffled2)).toBe(false)
  })

  it('produces same result with numeric version of string seed', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()

    const shuffled1 = shuffleDeck(deck1, '12345')
    const shuffled2 = shuffleDeck(deck2, 12345)

    expect(decksEqual(shuffled1, shuffled2)).toBe(true)
  })

  it('can reproduce a specific hand', () => {
    const deck1 = createDeck()
    const seed = 'reproduce-hand'

    const shuffled = shuffleDeck(deck1, seed)
    const firstCards = shuffled.slice(0, 4)

    const deck2 = createDeck()
    const shuffled2 = shuffleDeck(deck2, seed)

    const firstCards2 = shuffled2.slice(0, 4)
    expect(firstCards2.every((c, i) => cardsEqual(c, firstCards[i]))).toBe(true)
  })
})
