import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { wordsDatabase, initializeMissingElos, normalizeWord, WordInfo } from "./dictionary";
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
const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: corsOrigin }));
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

// Create a new word (Admin Panel)
app.post("/api/words", (req, res) => {
  const { displayWord, clues, elo } = req.body;
  if (!displayWord || typeof displayWord !== "string" || displayWord.trim() === "") {
    return res.status(400).json({ error: "O campo 'displayWord' é obrigatório e deve ser uma string não vazia." });
  }
  if (!clues || !Array.isArray(clues) || clues.length === 0) {
    return res.status(400).json({ error: "O campo 'clues' é obrigatório e deve conter ao menos 1 dica." });
  }

  const normalized = normalizeWord(displayWord);
  if (wordsDatabase.some(w => w.word === normalized)) {
    return res.status(400).json({ error: `A palavra "${normalized}" já está cadastrada no dicionário.` });
  }

  const cleanedClues = clues.map((c: any) => String(c).trim()).filter(Boolean);
  if (cleanedClues.length === 0) {
    return res.status(400).json({ error: "Ao menos uma dica válida deve ser fornecida." });
  }

  const wordElo = elo && typeof elo === "number" ? elo : 1200;

  const newWord: WordInfo = {
    id: `w${Date.now()}`,
    displayWord: displayWord.trim(),
    word: normalized,
    clues: cleanedClues,
    elo: wordElo,
    attempts: 0,
    solves: 0
  };

  wordsDatabase.push(newWord);
  res.status(201).json(newWord);
});

// Update an existing word (Admin Panel)
app.put("/api/words/:id", (req, res) => {
  const { id } = req.params;
  const { displayWord, clues, elo } = req.body;

  const wordIndex = wordsDatabase.findIndex(w => w.id === id);
  if (wordIndex === -1) {
    return res.status(404).json({ error: "Palavra não encontrada." });
  }

  if (displayWord !== undefined) {
    if (typeof displayWord !== "string" || displayWord.trim() === "") {
      return res.status(400).json({ error: "O campo 'displayWord' deve ser uma string não vazia." });
    }
    const normalized = normalizeWord(displayWord);
    if (wordsDatabase.some(w => w.word === normalized && w.id !== id)) {
      return res.status(400).json({ error: `A palavra "${normalized}" já está cadastrada em outro registro.` });
    }
    wordsDatabase[wordIndex].displayWord = displayWord.trim();
    wordsDatabase[wordIndex].word = normalized;
  }

  if (clues !== undefined) {
    if (!Array.isArray(clues) || clues.length === 0) {
      return res.status(400).json({ error: "O campo 'clues' deve ser um array contendo ao menos 1 dica." });
    }
    const cleanedClues = clues.map((c: any) => String(c).trim()).filter(Boolean);
    if (cleanedClues.length === 0) {
      return res.status(400).json({ error: "Ao menos uma dica válida deve ser fornecida." });
    }
    wordsDatabase[wordIndex].clues = cleanedClues;
  }

  if (elo !== undefined) {
    if (typeof elo !== "number") {
      return res.status(400).json({ error: "O campo 'elo' deve ser um número." });
    }
    wordsDatabase[wordIndex].elo = elo;
  }

  res.json(wordsDatabase[wordIndex]);
});

// Delete a word (Admin Panel)
app.delete("/api/words/:id", (req, res) => {
  const { id } = req.params;
  const wordIndex = wordsDatabase.findIndex(w => w.id === id);
  if (wordIndex === -1) {
    return res.status(404).json({ error: "Palavra não encontrada." });
  }

  const deleted = wordsDatabase.splice(wordIndex, 1)[0];
  res.json({ message: "Palavra excluída com sucesso.", word: deleted });
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

// Serve built frontend in production (must come after API routes)
if (isProduction) {
  const staticPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

// --- SOCKET.IO REALTIME EVENTS ---

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

io.on("connection", socket => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  console.log(`Socket connected: ${socket.id}`);

  // 1. Join room event
  socket.on("join_room", ({ roomId, userId, username, elo }) => {
    const uppercaseRoom = (roomId as string).toUpperCase();
    const session = joinSession(uppercaseRoom, userId, username, elo || 1200);
    if (!session) {
      socket.emit("error_msg", "A sala informada não existe.");
      return;
    }

    currentRoomId = uppercaseRoom;
    currentUserId = userId;

    socket.join(uppercaseRoom);
    console.log(`Player ${username} (${userId}) joined room: ${uppercaseRoom}`);

    io.to(uppercaseRoom).emit("room_state", {
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
        const assignedWord = session.board.solutions[clueId];
        const dictWord = wordsDatabase.find(w => w.word === assignedWord);
        const displayWord = dictWord ? dictWord.displayWord : assignedWord;

        // Broadcast word solved event to all players
        io.to(uppercaseRoom).emit("word_solved", {
          clueId,
          solvedClues: session.solvedClues,
          players: session.players, // Includes ELO updates if ranked!
          solution: assignedWord, // Share solution with the room since it's correct!
          displayWord: displayWord, // Accented version for presentation!
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
