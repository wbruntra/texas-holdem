export const cardValues = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

export const cardSuits = {
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
  S: 'spades',
}

export const cardTransformer = (
  card,
  config = {
    output: 'object',
  },
) => {
  if (config.output === 'string') {
    // if already string, return as is
    if (typeof card === 'string') {
      return card
    }

    // if object, convert to string
    return `${card.rank}${card.suit}`
  }

  if (typeof card === 'string') {
    // return object
    return {
      rank: card[0],
      suit: cardSuits[card[1]],
      value: cardValues[card[0]],
    }
  }

  return card
}
