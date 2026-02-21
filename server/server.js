const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const cors = require("cors");
const setupSocketHandlers = require("./socketHandlers");
const { createGame } = require("./gameState");

const app = express();
app.use(
  cors({
    origin: "*", // In production, change this to your Next.js domain
  }),
);
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Update this to your Next.js domain in production
    methods: ["GET", "POST"],
  },
});

// REST Endpoint to create a new game
app.post("/api/games", (req, res) => {
  const gameId = crypto.randomBytes(4).toString("hex"); // e.g., 'a1b2c3d4'
  const hostToken = crypto.randomBytes(16).toString("hex");

  // Initialize the game in our server state
  createGame(gameId, hostToken);

  res.json({ gameId, hostToken });
});

// Initialize WebSocket connections
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Poker backend running on port ${PORT}`);
});
