const {
  getGame,
  startNewHand,
  isBettingRoundOver,
  advancePhase,
  getNextActiveIndex,
  evaluateWinner,
} = require("./gameState");

module.exports = function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- NEW: HOST ROOM JOIN ---
    socket.on("join_host_room", ({ gameId, hostToken }) => {
      const game = getGame(gameId);
      // Verify they are actually the host before letting them in the secret room
      if (game && game.hostToken === hostToken) {
        socket.join(`${gameId}_host`);
        console.log(`Host joined control room for game: ${gameId}`);
      }
    });

    // --- 1. JOINING & RECONNECTING ---
    socket.on("join_game", ({ gameId, playerId }) => {
      const game = getGame(gameId);
      if (!game) return socket.emit("error", "Game not found");

      socket.join(gameId);
      socket.join(playerId);
      socket.gameId = gameId;
      socket.playerId = playerId;

      if (game.disconnectTimers.has(playerId)) {
        clearTimeout(game.disconnectTimers.get(playerId));
        game.disconnectTimers.delete(playerId);
      }

      socket.emit("game_state_sync", game);

      // --- NEW: Resend private cards if they refresh mid-hand ---
      const mySeat = game.seats.find((s) => s && s.id === playerId);
      if (mySeat && mySeat.cards) {
        socket.emit("private_cards", mySeat.cards);
      }
    });

    // --- 2. DISCONNECTION (2-Minute Grace Period) ---
    socket.on("disconnect", () => {
      if (!socket.gameId || !socket.playerId) return;

      const game = getGame(socket.gameId);
      if (game) {
        // Start a 2-minute (120,000ms) grace period timer
        const timer = setTimeout(() => {
          // If they don't reconnect in 2 mins, remove from seat and fold hand
          const seatIndex = game.seats.findIndex(
            (s) => s && s.id === socket.playerId,
          );
          if (seatIndex !== -1) {
            game.seats[seatIndex] = null; // Vacate seat
            io.to(socket.gameId).emit("player_removed", { seatIndex });
          }
          game.disconnectTimers.delete(socket.playerId);
        }, 120000);

        game.disconnectTimers.set(socket.playerId, timer);
      }
    });

    // --- 3. SEATING & HOST APPROVAL ---
    socket.on(
      "request_seat",
      ({ gameId, seatIndex, buyInAmount, playerInfo, hostToken }) => {
        const game = getGame(gameId);
        if (!game || game.seats[seatIndex] !== null) return;

        // NEW ANTI-CLONE CHECK: Is this player ID already in another seat?
        const isAlreadySeated = game.seats.some(
          (s) => s && s.id === playerInfo.id,
        );
        if (isAlreadySeated) {
          return socket.emit("error", "You are already seated at this table.");
        }
        // NEW: Host Auto-Seat Bypass
        // If the host asks for a seat, seat them instantly without approval
        if (hostToken && game.hostToken === hostToken) {
          game.seats[seatIndex] = {
            ...playerInfo,
            chips: buyInAmount,
            id: playerInfo.id,
          };
          io.to(gameId).emit("seat_updated", {
            seatIndex,
            player: game.seats[seatIndex],
          });
          socket.emit("seat_approved", { seatIndex });
          return;
        }

        // Send the request specifically to the host
        // (Assuming the host joined a special Socket.IO room with their token)
        io.to(`${gameId}_host`).emit("seat_request_pending", {
          seatIndex,
          buyInAmount,
          playerInfo,
          socketId: socket.id, // So we know who to respond to
        });
      },
    );

    socket.on(
      "resolve_seat_request",
      ({
        gameId,
        hostToken,
        approved,
        targetSocketId,
        seatIndex,
        buyInAmount,
        playerInfo,
      }) => {
        const game = getGame(gameId);
        if (!game || game.hostToken !== hostToken) return; // Verify host

        if (approved) {
          game.seats[seatIndex] = {
            ...playerInfo,
            chips: buyInAmount,
            id: playerInfo.id,
          };
          io.to(gameId).emit("seat_updated", {
            seatIndex,
            player: game.seats[seatIndex],
          });
          io.to(targetSocketId).emit("seat_approved", { seatIndex });
        } else {
          io.to(targetSocketId).emit("seat_rejected", {
            reason: "Host declined your buy-in.",
          });
        }
      },
    );

    // --- 4. HOST MONEY MANAGEMENT ---
    socket.on(
      "host_adjust_chips",
      ({ gameId, hostToken, seatIndex, amountDelta }) => {
        const game = getGame(gameId);
        if (!game || game.hostToken !== hostToken) return;

        const player = game.seats[seatIndex];
        if (player) {
          player.chips += amountDelta; // amountDelta can be positive (give) or negative (take)
          io.to(gameId).emit("chips_adjusted", {
            seatIndex,
            newTotal: player.chips,
          });
        }
      },
    );

    // --- 5. HOST SETTINGS UPDATE ---
    socket.on("update_settings", ({ gameId, hostToken, settings }) => {
      const game = getGame(gameId);
      if (!game || game.hostToken !== hostToken) return;

      if (game.phase === "waiting") {
        // If no hand is active, apply immediately
        game.settings = { ...game.settings, ...settings };
        io.to(gameId).emit("settings_updated", game.settings);
      } else {
        // Queue settings for the next hand
        game.queuedSettings = settings;
        socket.emit("settings_queued"); // Tell the host it's scheduled
      }
    });

    // --- START GAME LOOP ---
    socket.on("start_game", ({ gameId, hostToken }) => {
      const game = getGame(gameId);
      if (!game || game.hostToken !== hostToken) return;

      const activePlayers = game.seats.filter((seat) => seat !== null);
      if (activePlayers.length < 2) {
        return socket.emit("error", "Need at least 2 players to start.");
      }

      // Kick off the infinite loop!
      triggerNextHand(gameId, io);
      io.to(`${gameId}_host`).emit("game_started");
    });

    // --- CORE GAMEPLAY LOGIC: FOLD / CALL / RAISE ---
    socket.on("player_action", ({ gameId, action, amount }) => {
      const game = getGame(gameId);
      if (!game || game.phase === "waiting" || game.phase === "showdown")
        return;

      const playerIndex = game.seats.findIndex(
        (s) => s && s.id === socket.playerId,
      );
      if (playerIndex === -1 || game.currentTurnIndex !== playerIndex)
        return socket.emit("error", "Not your turn!");

      const player = game.seats[playerIndex];

      if (action === "fold") {
        player.inHand = false;
      } else if (action === "call") {
        const amountToCall = game.highestBet - player.currentBet;
        const actualCall = Math.min(amountToCall, player.chips);
        player.chips -= actualCall;
        player.currentBet += actualCall;
        game.pots[0].amount += actualCall;
      } else if (action === "raise") {
        const additionalChips = amount - player.currentBet;
        if (additionalChips > player.chips || amount <= game.highestBet) return;

        player.chips -= additionalChips;
        player.currentBet = amount;
        game.highestBet = amount;
        game.pots[0].amount += additionalChips;

        // A raise re-opens the betting for everyone else
        game.seats.forEach((s) => {
          if (s && s.id !== player.id && s.inHand && s.chips > 0)
            s.hasActed = false;
        });
      }

      player.hasActed = true;

      // --- CHECK IF ROUND IS OVER ---
      const activePlayersLeft = game.seats.filter((s) => s && s.inHand);

      if (activePlayersLeft.length === 1) {
        // SCENARIO 1: Everyone folded!
        const winner = activePlayersLeft[0];
        winner.chips += game.pots[0].amount;
        game.pots[0].amount = 0;
        game.phase = "showdown"; // Freeze the UI

        // Tell the frontend someone won by folding
        io.to(gameId).emit("round_ended", {
          winners: [{ id: winner.id }],
          winningDescription: "Opponents Folded",
          allHoleCards: [], // No cards revealed if everyone folds
        });

        // Wait 4 seconds, then auto-deal
        setTimeout(() => triggerNextHand(gameId, io), 4000);
      } else if (isBettingRoundOver(game)) {
        // SCENARIO 2: Betting round is over, deal community cards
        advancePhase(game);

        if (game.phase === "showdown") {
          // It's the end of the River! Time to evaluate hands.
          console.log(`Evaluating Showdown for game ${gameId}...`);

          const showdownData = evaluateWinner(game);

          // Split the pot among the winner(s) (handles ties!)
          const totalPot = game.pots[0].amount;
          const winAmount = Number(
            (totalPot / showdownData.winners.length).toFixed(2),
          );
          showdownData.winners.forEach((w) => {
            w.chips = Number((w.chips + winAmount).toFixed(2));
          });
          game.pots[0].amount = 0;

          const revealedCards = showdownData.winners.map((w) => ({
            id: w.id,
            cards: w.cards,
          }));

          // Send the winning data and REVEAL THE CARDS to the frontend
          io.to(gameId).emit("round_ended", {
            winners: showdownData.winners.map((w) => ({ id: w.id })),
            winningDescription: showdownData.winningDescription,
            allHoleCards: revealedCards,
          });

          // Wait 8 seconds so players can see the cards and gloat, then auto-deal
          setTimeout(() => triggerNextHand(gameId, io), 8000);
        }
      } else {
        // Round isn't over, just move to the next player
        game.currentTurnIndex = getNextActiveIndex(game, game.currentTurnIndex);
      }

      broadcastSafeState(io, gameId, game);
    });

    // --- STAND UP / LEAVE SEAT ---
    socket.on("stand_up", ({ gameId }) => {
      const game = getGame(gameId);
      if (!game) return;

      const seatIndex = game.seats.findIndex(
        (s) => s && s.id === socket.playerId,
      );
      if (seatIndex === -1) return;

      const player = game.seats[seatIndex];

      if (game.phase === "waiting" || game.phase === "showdown") {
        game.seats[seatIndex] = null;
        io.to(gameId).emit("seat_updated", { seatIndex, player: null });
        socket.emit("stood_up");
      } else {
        player.queuedToLeave = true;
        socket.emit("stand_up_queued");
      }

      // NEW: Tell everyone at the table that this player is queued to leave!
      broadcastSafeState(io, gameId, game);
    });
  });
};

function broadcastSafeState(io, gameId, game) {
  const publicGameState = JSON.parse(JSON.stringify(game)); // Deep copy

  publicGameState.seats.forEach((seat) => {
    if (seat) delete seat.cards; // NEVER broadcast the hole cards!
  });

  // Replace the deck array with just a number (so clients know how many cards are left, but not what they are)
  if (Array.isArray(publicGameState.deck)) {
    publicGameState.deck = publicGameState.deck.length;
  }

  io.to(gameId).emit("game_state_sync", publicGameState);
}

// --- AUTO-DEAL GAME LOOP HELPER ---
function triggerNextHand(gameId, io) {
  const game = getGame(gameId);
  if (!game) return;

  if (game.queuedSettings) {
    game.settings = { ...game.settings, ...game.queuedSettings };
    io.to(gameId).emit("settings_updated", game.settings);
    game.queuedSettings = null; // Clear the queue
  }

  // 1. Process players who requested to stand up during the last hand
  game.seats.forEach((seat, index) => {
    if (seat && seat.queuedToLeave) {
      game.seats[index] = null;
      io.to(gameId).emit("seat_updated", { seatIndex: index, player: null });
      io.to(seat.id).emit("stood_up"); // Tell their client to reset UI
      console.log(`Player ${seat.name} left seat ${index}.`);
    }
  });

  // 2. Check if we still have at least 2 seated players who aren't bankrupt
  const capablePlayers = game.seats.filter(
    (seat) => seat !== null && seat.chips > 0,
  );

  if (capablePlayers.length < 2) {
    console.log(`Game ${gameId} paused: Not enough players.`);
    game.phase = "waiting";
    broadcastSafeState(io, gameId, game);
    io.to(gameId).emit("error", "Not enough players to continue. Game paused.");
    return;
  }

  // Use the engine to initialize the new hand
  startNewHand(game);

  // Send the new private hole cards securely
  game.seats.forEach((seat) => {
    if (seat && seat.inHand) {
      io.to(seat.id).emit("private_cards", seat.cards);
    }
  });

  console.log(`Dealing new hand for game ${gameId}...`);
  broadcastSafeState(io, gameId, game);
}
