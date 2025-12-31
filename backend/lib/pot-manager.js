const { PLAYER_STATUS } = require('./game-constants');
const { compareHands } = require('./poker-engine');

/**
 * Calculate side pots based on player contributions and status
 * @param {Array} players - Array of player objects with totalBet and status
 * @returns {Array} Array of pot objects with amount and eligiblePlayers
 */
function calculatePots(players) {
  // Create working array with position, contribution, and active status
  const contributions = players.map((p, idx) => ({
    position: idx,
    amount: p.totalBet || 0,
    isActive:
      p.status === PLAYER_STATUS.ACTIVE || p.status === PLAYER_STATUS.ALL_IN,
    isFolded: p.status === PLAYER_STATUS.FOLDED,
  }));

  // Separate active players from folded (folded contribute but can't win)
  const activePlayers = contributions.filter((c) => c.isActive);
  const foldedContributions = contributions
    .filter((c) => c.isFolded)
    .reduce((sum, c) => sum + c.amount, 0);

  if (activePlayers.length === 0) {
    // Everyone folded (shouldn't happen but handle it)
    return [
      {
        amount: foldedContributions,
        eligiblePlayers: [],
        winners: null,
      },
    ];
  }

  // Sort active players by contribution (ascending)
  activePlayers.sort((a, b) => a.amount - b.amount);

  const pots = [];
  let remainingPlayers = [...activePlayers];
  let prevLevel = 0;

  while (remainingPlayers.length > 0) {
    const currentLevel = remainingPlayers[0].amount;
    const increment = currentLevel - prevLevel;

    if (increment > 0) {
      // Create a pot for this level
      const potAmount = increment * remainingPlayers.length;
      const eligiblePositions = remainingPlayers
        .map((p) => p.position)
        .sort((a, b) => a - b);

      pots.push({
        amount: potAmount,
        eligiblePlayers: eligiblePositions,
        winners: null,
      });
    }

    // Remove players who are tapped out at this level
    remainingPlayers = remainingPlayers.filter((p) => p.amount > currentLevel);
    prevLevel = currentLevel;
  }

  // Add folded contributions to the first pot (main pot)
  if (pots.length > 0 && foldedContributions > 0) {
    pots[0].amount += foldedContributions;
  }

  return pots;
}

/**
 * Distribute pots to winners based on hand rankings
 * @param {Array} pots - Array of pot objects
 * @param {Array} players - Array of player objects with holeCards
 * @param {Array} communityCards - Community cards
 * @param {Function} evaluateHand - Function to evaluate poker hands
 * @returns {Array} Updated pots with winners assigned
 */
function distributePots(pots, players, communityCards, evaluateHand) {
  const results = pots.map((pot) => {
    // Get eligible players who can win this pot
    const eligiblePlayers = pot.eligiblePlayers
      .map((pos) => ({ position: pos, player: players[pos] }))
      .filter(
        ({ player }) =>
          player && player.holeCards && player.holeCards.length === 2
      );

    if (eligiblePlayers.length === 0) {
      // No eligible players (shouldn't happen)
      return { ...pot, winners: [] };
    }

    // Evaluate each eligible player's hand
    const evaluations = eligiblePlayers.map(({ position, player }) => {
      const hand = evaluateHand([...player.holeCards, ...communityCards]);
      return { position, hand };
    });

    // Find the best hand by comparing rank first, then value as tiebreaker
    let bestHand = evaluations[0].hand;
    for (let i = 1; i < evaluations.length; i++) {
      const comp = compareHands(evaluations[i].hand, bestHand);
      if (comp > 0) {
        bestHand = evaluations[i].hand;
      }
    }

    // Find all players with the best hand (could be a tie)
    const winners = evaluations
      .filter((e) => compareHands(e.hand, bestHand) === 0)
      .map((e) => e.position);

    return {
      ...pot,
      winners,
      winAmount: Math.floor(pot.amount / winners.length), // Each winner gets equal share
      winningRankName: bestHand.rankName, // Include hand rank name for display
    };
  });

  return results;
}

/**
 * Award pot winnings to players
 * @param {Array} pots - Array of pot objects with winners assigned
 * @param {Array} players - Array of player objects to update
 * @returns {Array} Updated players with chips awarded
 */
function awardPots(pots, players) {
  const updatedPlayers = players.map((p) => ({ ...p }));

  pots.forEach((pot) => {
    if (pot.winners && pot.winners.length > 0) {
      const amountPerWinner = Math.floor(pot.amount / pot.winners.length);
      const remainder = pot.amount % pot.winners.length;

      pot.winners.forEach((position, idx) => {
        // Give remainder to first winner (arbitrary but fair)
        const award = amountPerWinner + (idx === 0 ? remainder : 0);
        updatedPlayers[position].chips += award;
      });
    }
  });

  return updatedPlayers;
}

/**
 * Get total pot amount across all pots
 * @param {Array} pots - Array of pot objects
 * @returns {number} Total pot amount
 */
function getTotalPot(pots) {
  return pots.reduce((sum, pot) => sum + pot.amount, 0);
}

module.exports = {
  calculatePots,
  distributePots,
  awardPots,
  getTotalPot,
};
