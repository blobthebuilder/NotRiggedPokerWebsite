/**
 * Resolves the betting round and creates side pots if players are all-in.
 * @param {Array} players - Array of player objects { id, potCommitment, isAllIn, ... }
 */
function calculatePots(players) {
  let activePlayers = players.filter((p) => p.potCommitment > 0);
  const pots = [];

  while (activePlayers.length > 0) {
    // 1. Find the smallest commitment among all players who put money in
    const minCommitment = Math.min(
      ...activePlayers.map((p) => p.potCommitment),
    );

    // 2. Create a pot consisting of this minCommitment from everyone who contributed at least that much
    let potAmount = 0;
    let eligiblePlayers = [];

    activePlayers.forEach((p) => {
      potAmount += minCommitment;
      p.potCommitment -= minCommitment;
      eligiblePlayers.push(p.id);
    });

    pots.push({
      amount: potAmount,
      eligiblePlayers: eligiblePlayers,
    });

    // 3. Remove players who have 0 commitment left.
    // If they were all-in, they are only eligible for the pots created up to this point.
    activePlayers = activePlayers.filter((p) => p.potCommitment > 0);
  }

  return pots;
}
