const games = new Map();
const Hand = require("pokersolver").Hand;

function createDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const values = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "T",
    "J",
    "Q",
    "K",
    "A",
  ];
  const deck = [];
  for (let suit of suits) {
    for (let value of values) deck.push({ suit, value });
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createGame(gameId, hostToken) {
  games.set(gameId, {
    id: gameId,
    hostToken: hostToken,
    settings: { smallBlind: 10, bigBlind: 20, turnTimeoutMs: 30000 },
    seats: Array(10).fill(null),
    pots: [{ amount: 0, eligiblePlayers: [] }],
    disconnectTimers: new Map(),
    phase: "waiting",
    deck: [],
    communityCards: [],
    currentTurnIndex: null,
    dealerButtonIndex: -1, // Starts at -1 so the first hand moves it to 0
    highestBet: 0,
  });
}

function getGame(gameId) {
  return games.get(gameId);
}

// Helper: Finds the next seated player still in the hand
function getNextActiveIndex(game, startIndex) {
  let idx = (startIndex + 1) % 10;
  for (let i = 0; i < 10; i++) {
    const seat = game.seats[idx];
    if (seat && seat.inHand && seat.chips > 0) return idx; // Active and has chips
    idx = (idx + 1) % 10;
  }
  return -1;
}

// THE ROUND INITIALIZER
function startNewHand(game) {
  game.phase = "preflop";
  game.deck = shuffle(createDeck());
  game.communityCards = [];
  game.pots = [{ amount: 0, eligiblePlayers: [] }];
  game.highestBet = game.settings.bigBlind;

  // 1. FIRST: Mark all seated players with chips as active in the hand
  game.seats.forEach((s) => {
    if (s && s.chips > 0) {
      s.inHand = true;
      s.hasActed = false;
      s.currentBet = 0;
    } else if (s) {
      s.inHand = false; // Skip players who are out of chips
    }
  });

  // 2. NOW: Calculate the positions because players are officially 'inHand'
  game.dealerButtonIndex = getNextActiveIndex(
    game,
    game.dealerButtonIndex >= 0 ? game.dealerButtonIndex : 9,
  );

  const sbIndex = getNextActiveIndex(game, game.dealerButtonIndex);
  const bbIndex = getNextActiveIndex(game, sbIndex);
  const utgIndex = getNextActiveIndex(game, bbIndex); // Under the Gun acts first preflop

  // 3. Deal hole cards and auto-deduct the blinds
  game.seats.forEach((s, i) => {
    if (s && s.inHand) {
      s.cards = [game.deck.pop(), game.deck.pop()];

      // Post Small Blind
      if (i === sbIndex) {
        const amount = Math.min(s.chips, game.settings.smallBlind);
        s.chips -= amount;
        s.currentBet = amount;
        game.pots[0].amount += amount;
      }

      // Post Big Blind
      if (i === bbIndex) {
        const amount = Math.min(s.chips, game.settings.bigBlind);
        s.chips -= amount;
        s.currentBet = amount;
        game.pots[0].amount += amount;
      }
    }
  });

  // 4. Set the glowing UI turn indicator to the Under the Gun player
  game.currentTurnIndex = utgIndex;
}

// Checks if everyone has matched the highest bet or folded
function isBettingRoundOver(game) {
  const activePlayers = game.seats.filter((s) => s && s.inHand);
  if (activePlayers.length <= 1) return true; // Everyone folded

  // Round is over if everyone still in the hand has acted AND matched the bet (or is all-in)
  return activePlayers.every(
    (s) => (s.hasActed && s.currentBet === game.highestBet) || s.chips === 0,
  );
}

// Deals community cards and resets bets
function advancePhase(game) {
  game.highestBet = 0;
  game.seats.forEach((s) => {
    if (s) {
      s.currentBet = 0;
      // If they are in the hand and have chips, they need to act next round
      if (s.inHand && s.chips > 0) s.hasActed = false;
      else if (s) s.hasActed = true; // All-in or folded players don't act
    }
  });

  if (game.phase === "preflop") {
    game.phase = "flop";
    game.communityCards.push(game.deck.pop(), game.deck.pop(), game.deck.pop());
  } else if (game.phase === "flop") {
    game.phase = "turn";
    game.communityCards.push(game.deck.pop());
  } else if (game.phase === "turn") {
    game.phase = "river";
    game.communityCards.push(game.deck.pop());
  } else if (game.phase === "river") {
    game.phase = "showdown";
    return; // Showdown logic handled elsewhere
  }

  // After preflop, the first to act is the Small Blind (or next active after dealer)
  game.currentTurnIndex = getNextActiveIndex(game, game.dealerButtonIndex);
}

function evaluateWinner(game) {
  const activePlayers = game.seats.filter((s) => s && s.inHand);

  // Format the 5 community cards (e.g., { value: 'A', suit: 'spades' } -> 'As')
  const board = game.communityCards.map(
    (c) => c.value + c.suit[0].toLowerCase(),
  );

  // Solve each player's hand
  activePlayers.forEach((p) => {
    const hole = p.cards.map((c) => c.value + c.suit[0].toLowerCase());
    p.solvedHand = Hand.solve(hole.concat(board));
  });

  // Find the winning hand(s) - pokersolver handles ties automatically!
  const hands = activePlayers.map((p) => p.solvedHand);
  const winningHands = Hand.winners(hands);

  // Match the winning hands back to the players
  const winners = activePlayers.filter((p) =>
    winningHands.includes(p.solvedHand),
  );

  return {
    winners: winners,
    winningDescription: winningHands[0].descr, // e.g., "Flush, Ace High"
    allHoleCards: activePlayers.map((p) => ({ id: p.id, cards: p.cards })), // For revealing cards
  };
}

module.exports = {
  games,
  createGame,
  getGame,
  startNewHand,
  getNextActiveIndex,
  isBettingRoundOver,
  advancePhase,
  evaluateWinner,
};
