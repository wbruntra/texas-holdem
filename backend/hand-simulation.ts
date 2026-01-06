import { createDeck, shuffleDeck, evaluateHand } from './lib/poker-engine'

const SIMULATIONS = 10000

function runSimulation(cardCount: number) {
  const counts = new Map<string, number>()

  for (let i = 0; i < SIMULATIONS; i++) {
    const deck = shuffleDeck(createDeck())
    const hand = deck.slice(0, cardCount)
    const evaluation = evaluateHand(hand)
    const rankName = evaluation.rankName

    counts.set(rankName, (counts.get(rankName) || 0) + 1)
  }

  console.log(`\nPoker Hand Probabilities (${SIMULATIONS.toLocaleString()} hands)\n`)
  console.log(''.padEnd(25, '-') + ' ' + 'Count'.padEnd(12, '-') + 'Percentage')
  console.log(''.padEnd(50, '-'))

  const sortedRanks = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

  for (const [rankName, count] of sortedRanks) {
    const percentage = ((count / SIMULATIONS) * 100).toFixed(2)
    const paddedName = rankName.padEnd(25)
    const paddedCount = count.toLocaleString().padStart(10)
    const paddedPercentage = `${percentage}%`.padStart(10)
    console.log(`${paddedName} ${paddedCount} ${paddedPercentage}`)
  }

  console.log(''.padEnd(50, '-'))
}

const cardCount = parseInt(process.argv[2]) || 5

if (cardCount !== 5 && cardCount !== 7) {
  console.log('Usage: bun run backend/hand-simulation.ts [5|7]')
  process.exit(1)
}

runSimulation(cardCount)
