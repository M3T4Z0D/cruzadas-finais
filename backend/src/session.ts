import { GeneratedBoard, generateBoardForElo } from "./generator";
import { updateRatings } from "./elo";
import { recordWordAttempt } from "./dictionary";

export interface SessionPlayer {
  id: string;
  username: string;
  elo: number;
  color: string;
  cursorRow?: number;
  cursorCol?: number;
}

export interface GameSession {
  roomId: string;
  mode: "casual" | "ranked";
  board: GeneratedBoard;
  players: SessionPlayer[];
  gridState: string[][]; // 2D array of typed letters (size rows x cols)
  solvedClues: string[]; // List of clueIds solved
  createdAt: Date;
}

// In-memory active game rooms database
const activeSessions: Record<string, GameSession> = {};

// Colors for active multiplayer cursors
const CURSOR_COLORS = [
  "#FF5733", // Orange
  "#33FF57", // Green
  "#3357FF", // Blue
  "#F3FF33", // Yellow
  "#FF33F3", // Pink
  "#33FFF3", // Cyan
  "#C70039", // Red
  "#900C3F", // Deep Purple
];

/**
 * Generates a unique 4-character uppercase room code.
 */
function generateRoomCode(): string {
  let code = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (activeSessions[code]); // Ensure uniqueness
  return code;
}

/**
 * Creates a new multiplayer session/room.
 */
export function createSession(
  hostId: string,
  hostName: string,
  hostElo: number,
  mode: "casual" | "ranked"
): GameSession {
  const roomId = generateRoomCode();

  // Generate board based on host Elo
  const board = generateBoardForElo(hostElo, mode === "casual" ? "template_7x7" : "template_10x10");

  // Initialize empty grid state (rows x cols) filled with empty strings
  const gridState: string[][] = Array(board.rows)
    .fill(null)
    .map(() => Array(board.cols).fill(""));

  const host: SessionPlayer = {
    id: hostId,
    username: hostName,
    elo: hostElo,
    color: CURSOR_COLORS[0],
  };

  const session: GameSession = {
    roomId,
    mode,
    board,
    players: [host],
    gridState,
    solvedClues: [],
    createdAt: new Date(),
  };

  activeSessions[roomId] = session;
  return session;
}

/**
 * Joins an existing multiplayer room.
 */
export function joinSession(
  roomId: string,
  userId: string,
  userName: string,
  userElo: number
): GameSession | null {
  const session = activeSessions[roomId.toUpperCase()];
  if (!session) return null;

  // Check if player is already in the room
  const alreadyIn = session.players.find(p => p.id === userId);
  if (alreadyIn) return session;

  const playerColor = CURSOR_COLORS[session.players.length % CURSOR_COLORS.length];
  const newPlayer: SessionPlayer = {
    id: userId,
    username: userName,
    elo: userElo,
    color: playerColor,
  };

  session.players.push(newPlayer);
  return session;
}

/**
 * Retrieves a session by room code.
 */
export function getSession(roomId: string): GameSession | null {
  return activeSessions[roomId.toUpperCase()] || null;
}

/**
 * Removes a player from a room. If room becomes empty, deletes it.
 */
export function leaveSession(roomId: string, userId: string): GameSession | null {
  const session = activeSessions[roomId.toUpperCase()];
  if (!session) return null;

  session.players = session.players.filter(p => p.id !== userId);

  if (session.players.length === 0) {
    delete activeSessions[roomId.toUpperCase()];
    return null;
  }

  return session;
}

/**
 * Updates a cell's letter in the room grid state.
 */
export function updateCellState(roomId: string, row: number, col: number, letter: string): boolean {
  const session = activeSessions[roomId.toUpperCase()];
  if (!session) return false;

  // Ensure row/col boundaries
  if (row < 0 || row >= session.board.rows || col < 0 || col >= session.board.cols) {
    return false;
  }

  session.gridState[row][col] = letter.toUpperCase().slice(0, 1);
  return true;
}

/**
 * Validates a word submission for a specific clue slot.
 * If correct, updates ELO math and records solves in database.
 */
export function validateClueAttempt(
  roomId: string,
  clueId: string,
  attempt: string,
  userId: string
): { success: boolean; isBoardComplete: boolean; playerEloChange?: number; wordEloChange?: number } {
  const session = activeSessions[roomId.toUpperCase()];
  if (!session) return { success: false, isBoardComplete: false };

  const player = session.players.find(p => p.id === userId);
  if (!player) return { success: false, isBoardComplete: false };

  // Find solution in backend
  const solution = session.board.solutions[clueId];
  if (!solution) return { success: false, isBoardComplete: false };

  const cleanAttempt = attempt.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanSolution = solution.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const isCorrect = cleanAttempt === cleanSolution;

  if (isCorrect) {
    // Prevent double score if already solved
    if (!session.solvedClues.includes(clueId)) {
      session.solvedClues.push(clueId);

      // In Ranked mode, compute ELO changes!
      if (session.mode === "ranked") {
        // Find word in dictionary to adjust its dynamic rating
        const clueMetadata = session.board.clues.find(c => c.id === clueId);
        const assignedWord = session.board.solutions[clueId];
        
        // Find dict word
        const dictionary = require("./dictionary"); // Dynamic import to prevent circular dependency
        const dictWord = dictionary.wordsDatabase.find((w: any) => w.word === assignedWord);

        if (dictWord) {
          // Adjust Ratings
          const { newPlayerRating, newWordRating } = updateRatings(
            player.elo,
            dictWord.elo,
            1.0 // Win for Player
          );

          const playerEloChange = newPlayerRating - player.elo;
          const wordEloChange = newWordRating - dictWord.elo;

          // Commit to player and dictionary
          player.elo = newPlayerRating;
          dictionary.recordWordAttempt(dictWord.id, true, newWordRating);

          const isBoardComplete = session.solvedClues.length === session.board.clues.length;

          return {
            success: true,
            isBoardComplete,
            playerEloChange,
            wordEloChange,
          };
        }
      }
    }

    const isBoardComplete = session.solvedClues.length === session.board.clues.length;
    return { success: true, isBoardComplete };
  } else {
    // Incorrect Attempt: In Ranked, we could slightly penalize the Elo, but let's only update ELO at the end or on give-ups.
    // For words, we record an attempt with failure (so word rating goes up!)
    if (session.mode === "ranked") {
      const assignedWord = session.board.solutions[clueId];
      const dictionary = require("./dictionary");
      const dictWord = dictionary.wordsDatabase.find((w: any) => w.word === assignedWord);

      if (dictWord) {
        const { newPlayerRating, newWordRating } = updateRatings(
          player.elo,
          dictWord.elo,
          0.0 // Loss for Player
        );

        const playerEloChange = newPlayerRating - player.elo;
        const wordEloChange = newWordRating - dictWord.elo;

        player.elo = newPlayerRating;
        dictionary.recordWordAttempt(dictWord.id, false, newWordRating);

        return {
          success: false,
          isBoardComplete: false,
          playerEloChange,
          wordEloChange,
        };
      }
    }

    return { success: false, isBoardComplete: false };
  }
}
