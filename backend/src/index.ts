import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { wordsDatabase, initializeMissingElos } from "./dictionary";
import {
  createSession,
  joinSession,
  getSession,
  leaveSession,
  updateCellState,
  validateClueAttempt,
} from "./session";

dotenv.config();
initializeMissingElos();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- REST API ROUTES ---

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Ranked Direct Crosswords API is fully operational." });
});

// Get words database (for stats & dictionary viewer)
app.get("/api/words", (req, res) => {
  res.json(wordsDatabase);
});

// Create a new session
app.post("/api/sessions", (req, res) => {
  const { hostId, hostName, hostElo, mode } = req.body;
  if (!hostId || !hostName) {
    return res.status(400).json({ error: "hostId and hostName are required." });
  }

  const session = createSession(hostId, hostName, hostElo || 1200, mode || "casual");
  res.status(201).json({
    roomId: session.roomId,
    mode: session.mode,
    board: {
      templateId: session.board.templateId,
      rows: session.board.rows,
      cols: session.board.cols,
      matrix: session.board.matrix,
      clues: session.board.clues, // Safe clues list (no solutions!)
      averageElo: session.board.averageElo,
    },
    players: session.players,
    gridState: session.gridState,
    solvedClues: session.solvedClues,
  });
});

// Get active room details (safe mode)
app.get("/api/sessions/:roomId", (req, res) => {
  const { roomId } = req.params;
  const session = getSession(roomId);

  if (!session) {
    return res.status(404).json({ error: "Session room not found." });
  }

  res.json({
    roomId: session.roomId,
    mode: session.mode,
    board: {
      templateId: session.board.templateId,
      rows: session.board.rows,
      cols: session.board.cols,
      matrix: session.board.matrix,
      clues: session.board.clues,
      averageElo: session.board.averageElo,
    },
    players: session.players,
    gridState: session.gridState,
    solvedClues: session.solvedClues,
  });
});

// --- SOCKET.IO REALTIME EVENTS ---

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow any frontend client connection for local dev
    methods: ["GET", "POST"],
  },
});

io.on("connection", socket => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  console.log(`Socket connected: ${socket.id}`);

  // 1. Join room event
  socket.on("join_room", ({ roomId, userId, username, elo }) => {
    const session = joinSession(roomId, userId, username, elo || 1200);
    if (!session) {
      socket.emit("error_msg", "A sala informada não existe.");
      return;
    }

    currentRoomId = roomId.toUpperCase();
    currentUserId = userId;

    socket.join(currentRoomId);
    console.log(`Player ${username} (${userId}) joined room: ${currentRoomId}`);

    // Broadcast updated player list to everyone in the room
    io.to(currentRoomId).emit("room_state", {
      players: session.players,
      gridState: session.gridState,
      solvedClues: session.solvedClues,
    });
  });

  // 2. Cell typing event (real-time cell letters synchronization)
  socket.on("type_cell", ({ roomId, row, col, letter, userId }) => {
    const uppercaseRoom = roomId.toUpperCase();
    const success = updateCellState(uppercaseRoom, row, col, letter);

    if (success) {
      // Broadcast character change to all other players in the room
      socket.to(uppercaseRoom).emit("cell_updated", {
        row,
        col,
        letter: letter.toUpperCase(),
        userId,
      });
    }
  });

  // 3. Figma-like cursors: Mouse focus / arrow selection
  socket.on("move_cursor", ({ roomId, row, col, userId }) => {
    const uppercaseRoom = roomId.toUpperCase();
    const session = getSession(uppercaseRoom);
    if (session) {
      const player = session.players.find(p => p.id === userId);
      if (player) {
        player.cursorRow = row;
        player.cursorCol = col;

        // Broadcast player cursor location to others in the room
        socket.to(uppercaseRoom).emit("cursor_moved", {
          userId,
          username: player.username,
          color: player.color,
          row,
          col,
        });
      }
    }
  });

  // 4. Word solution submit event
  socket.on("submit_word", ({ roomId, clueId, attempt, userId }) => {
    const uppercaseRoom = roomId.toUpperCase();
    const result = validateClueAttempt(uppercaseRoom, clueId, attempt, userId);

    if (result.success) {
      const session = getSession(uppercaseRoom);
      if (session) {
        // Broadcast word solved event to all players
        io.to(uppercaseRoom).emit("word_solved", {
          clueId,
          solvedClues: session.solvedClues,
          players: session.players, // Includes ELO updates if ranked!
          solution: session.board.solutions[clueId], // Share solution with the room since it's correct!
          playerEloChange: result.playerEloChange,
          wordEloChange: result.wordEloChange,
          solverId: userId,
        });

        // Check if the whole board is finished
        if (result.isBoardComplete) {
          io.to(uppercaseRoom).emit("board_completed", {
            message: "Parabéns! O tabuleiro de cruzadas foi totalmente resolvido!",
            players: session.players,
          });
        }
      }
    } else {
      // Return error to the solver
      socket.emit("word_failed", {
        clueId,
        message: "Palavra incorreta.",
        playerEloChange: result.playerEloChange,
        wordEloChange: result.wordEloChange,
        players: getSession(uppercaseRoom)?.players,
      });

      // Broadcast ELO drop if in ranked mode
      if (result.playerEloChange) {
        const session = getSession(uppercaseRoom);
        if (session) {
          io.to(uppercaseRoom).emit("room_state", {
            players: session.players,
            gridState: session.gridState,
            solvedClues: session.solvedClues,
          });
        }
      }
    }
  });

  // 5. Leaving room manually
  socket.on("leave_room", ({ roomId, userId }) => {
    const uppercaseRoom = roomId.toUpperCase();
    console.log(`User ${userId} leaving room ${uppercaseRoom}`);
    socket.leave(uppercaseRoom);
    const session = leaveSession(uppercaseRoom, userId);

    if (session) {
      io.to(uppercaseRoom).emit("room_state", {
        players: session.players,
        gridState: session.gridState,
        solvedClues: session.solvedClues,
      });
    }

    currentRoomId = null;
    currentUserId = null;
  });

  // 6. Handle socket disconnect
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (currentRoomId && currentUserId) {
      const session = leaveSession(currentRoomId, currentUserId);
      if (session) {
        io.to(currentRoomId).emit("room_state", {
          players: session.players,
          gridState: session.gridState,
          solvedClues: session.solvedClues,
        });
      }
    }
  });
});

// Start the server
server.listen(port, () => {
  console.log(`==================================================`);
  console.log(`⚡️ Ranked Direct Crosswords Server running on port ${port}`);
  console.log(`==================================================`);
});
