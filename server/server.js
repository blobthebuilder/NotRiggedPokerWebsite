const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const cors = require("cors");
const setupSocketHandlers = require("./socketHandlers");
const { createGame, games } = require("./gameState");

const app = express();
app.use(
  cors({
    origin: [
      "https://notriggedpokerwebsite.onrender.com",
      "http://localhost:3000",
    ],
  }),
);
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://notriggedpokerwebsite.onrender.com",
      "http://localhost:3000",
    ], // Update this to your Next.js domain in production
    methods: ["GET", "POST"],
  },
});

app.get("/api/games", (req, res) => {
  res.status(200).send("Server is awake");
});

// REST Endpoint to create a new game
app.post("/api/games", (req, res) => {
  try {
    const gameId = crypto.randomBytes(4).toString("hex");
    const hostToken = crypto.randomBytes(16).toString("hex");

    // This will now throw if the Map is full
    createGame(gameId, hostToken);

    res.json({ gameId, hostToken });
  } catch (error) {
    if (error.message === "MAX_CAPACITY") {
      return res.status(503).json({
        error: "Server Full",
        message:
          "The server has reached maximum capacity. Please try again later.",
      });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Initialize WebSocket connections
setupSocketHandlers(io);

// clean up old games
setInterval(() => {
  console.log(`Current active games: ${games.size}`);
  for (const [gameId, game] of games.entries()) {
    const hasPlayers = game.seats.some((s) => s !== null);
    // If no one is sitting at the table, delete the game to save RAM
    if (!hasPlayers) {
      console.log(`Cleaning up empty game: ${gameId}`);
      games.delete(gameId);
    }
  }
}, 600000);
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Poker backend running on port ${PORT}`);
});
