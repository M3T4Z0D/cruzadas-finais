import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { 
  User as UserIcon, Award, Trophy, Users, Play, ArrowRight, ArrowDown, 
  HelpCircle, LogIn, LogOut, Plus, Hash, Volume2, RefreshCw, Sparkles, Check, X,
  Sun, Moon, BookOpen
} from "lucide-react";
import "./App.css";

// --- LOCAL FALLBACK ENGINE (For Offline / Pure Client Mode) ---
import { getExpectedScore, updateRatings, calculateInitialWordElo } from "./engine/elo";
import { wordsDatabase as initialWords, recordWordAttempt } from "./engine/dictionary";
import { gridTemplates } from "./engine/templates";
import { generateBoardForElo } from "./engine/generator";

const BACKEND_URL = "http://localhost:5000";

function App() {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showGoogleSim, setShowGoogleSim] = useState(false);

  // Navigation states: 'dashboard' | 'game'
  const [currentView, setCurrentView] = useState("dashboard");
  const [gameMode, setGameMode] = useState("casual"); // 'casual' | 'ranked' | 'group'
  const [roomCode, setRoomCode] = useState("");
  const [roomInput, setRoomInput] = useState("");

  // Game/Grid States
  const [board, setBoard] = useState(null);
  const [grid, setGrid] = useState([]); // 2D grid array of letters typed
  const [players, setPlayers] = useState([]);
  const [solvedClues, setSolvedClues] = useState([]);
  const [activeCell, setActiveCell] = useState(null); // { r, c }
  const [activeClue, setActiveClue] = useState(null); // Clue object currently typing
  const [typingDirection, setTypingDirection] = useState("horizontal"); // 'horizontal' | 'vertical'
  const [validationStatuses, setValidationStatuses] = useState({}); // clueId -> 'correct' | 'incorrect'

  // Socket and Multiplayer States
  const [socketConnected, setSocketConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState({}); // userId -> { username, color, r, c }
  const [isBoardCompleted, setIsBoardCompleted] = useState(false);
  const [completedStats, setCompletedStats] = useState(null);

  // Notification Banner
  const [notification, setNotification] = useState(null); // { message, type }

  // Simulation Panel States
  const [simulateMultiplayer, setSimulateMultiplayer] = useState(false);
  const [simulatedLogs, setSimulatedLogs] = useState([]);

  // Dictionary viewer state
  const [showDictionary, setShowDictionary] = useState(false);
  const [localWords, setLocalWords] = useState(initialWords);

  // Theme states
  const [theme, setTheme] = useState("light"); // 'light' | 'dark' | 'newspaper'

  useEffect(() => {
    document.body.className = "";
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
    } else if (theme === "newspaper") {
      document.body.classList.add("newspaper-theme");
    }
  }, [theme]);

  const socketRef = useRef(null);
  const inputRefs = useRef({}); // Stores cell-input element refs

  // --- CONNECT SOCKET ---
  useEffect(() => {
    socketRef.current = io(BACKEND_URL, {
      autoConnect: false,
      reconnectionAttempts: 3,
      timeout: 3000
    });

    socketRef.current.on("connect", () => {
      setSocketConnected(true);
      console.log("Connected to Realtime Backend Server");
    });

    socketRef.current.on("connect_error", () => {
      setSocketConnected(false);
      console.warn("Backend server offline. Running in standalone local engine.");
    });

    socketRef.current.on("disconnect", () => {
      setSocketConnected(false);
    });

    // Realtime events
    socketRef.current.on("room_state", ({ players: roomPlayers, gridState, solvedClues: solved }) => {
      setPlayers(roomPlayers);
      setGrid(gridState);
      setSolvedClues(solved);
    });

    socketRef.current.on("cell_updated", ({ row, col, letter, userId }) => {
      setGrid(prev => {
        const copy = prev.map(r => [...r]);
        copy[row][col] = letter;
        return copy;
      });
    });

    socketRef.current.on("cursor_moved", ({ userId, username, color, row, col }) => {
      setRemoteCursors(prev => ({
        ...prev,
        [userId]: { username, color, r: row, c: col }
      }));
    });

    socketRef.current.on("word_solved", ({ clueId, solvedClues: solved, players: updatedPlayers, solution, playerEloChange, wordEloChange, solverId }) => {
      setSolvedClues(solved);
      setPlayers(updatedPlayers);
      setValidationStatuses(prev => ({ ...prev, [clueId]: "correct" }));

      // Fill in correct word letters to grid
      const solvedClue = board?.clues.find(c => c.id === clueId);
      if (solvedClue) {
        setGrid(prev => {
          const copy = prev.map(r => [...r]);
          for (let i = 0; i < solvedClue.length; i++) {
            const r = solvedClue.direction === "horizontal" ? solvedClue.startRow : solvedClue.startRow + i;
            const c = solvedClue.direction === "horizontal" ? solvedClue.startCol + i : solvedClue.startCol;
            copy[r][c] = solution[i];
          }
          return copy;
        });
      }

      // Show toast
      const solver = updatedPlayers.find(p => p.id === solverId);
      const suffix = playerEloChange ? ` (${playerEloChange >= 0 ? "+" : ""}${playerEloChange} Elo)` : "";
      showToast(`${solver?.username || "Um amigo"} resolveu "${dictTranslate(clueId)}"!${suffix}`, "success");
    });

    socketRef.current.on("word_failed", ({ clueId, message, playerEloChange, players: updatedPlayers }) => {
      setValidationStatuses(prev => ({ ...prev, [clueId]: "incorrect" }));
      if (updatedPlayers) setPlayers(updatedPlayers);
      
      const suffix = playerEloChange ? ` (${playerEloChange} Elo)` : "";
      showToast(`Tentativa de palavra incorreta!${suffix}`, "error");

      // Auto clear incorrect status after 2 seconds
      setTimeout(() => {
        setValidationStatuses(prev => ({ ...prev, [clueId]: null }));
      }, 2000);
    });

    socketRef.current.on("board_completed", ({ message, players: updatedPlayers }) => {
      setPlayers(updatedPlayers);
      setIsBoardCompleted(true);
      setCompletedStats({
        message,
        averageElo: board?.averageElo || 1200
      });
    });

    // Try connecting initially
    socketRef.current.connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [board]);

  // Translate clue IDs to clean label
  const dictTranslate = (clueId) => {
    const clue = board?.clues.find(c => c.id === clueId);
    return clue ? clue.clueText : "Dica";
  };

  // --- MOCK DATA FOR SIMULATION ---
  const MOCK_BOTS = [
    { id: "bot1", username: "GamerPro_PT", elo: 1350, color: "#33FF57" },
    { id: "bot2", username: "Cruzadista99", elo: 1150, color: "#3357FF" },
    { id: "bot3", username: "MestreDasPalavras", elo: 1520, color: "#FF33F3" }
  ];

  // --- AUTOMATED MULTIPLAYER SIMULATOR ---
  useEffect(() => {
    if (!simulateMultiplayer || gameMode !== "group") return;

    // Simulate other players joining
    const botJoinTimer = setTimeout(() => {
      setPlayers(prev => {
        const added = [...prev];
        MOCK_BOTS.forEach(bot => {
          if (!added.some(p => p.id === bot.id)) added.push(bot);
        });
        return added;
      });
      logSim("Jogadores GamerPro_PT, Cruzadista99 e MestreDasPalavras entraram na sala.");
    }, 1500);

    // Simulate cursor movements and random letters typing
    const simActivityInterval = setInterval(() => {
      if (!board) return;
      const randomBot = MOCK_BOTS[Math.floor(Math.random() * MOCK_BOTS.length)];
      const randomClue = board.clues[Math.floor(Math.random() * board.clues.length)];
      if (solvedClues.includes(randomClue.id)) return;

      const randomCharIndex = Math.floor(Math.random() * randomClue.length);
      const row = randomClue.direction === "horizontal" ? randomClue.startRow : randomClue.startRow + randomCharIndex;
      const col = randomClue.direction === "horizontal" ? randomClue.startCol + randomCharIndex : randomClue.startCol;

      // Update cursor
      setRemoteCursors(prev => ({
        ...prev,
        [randomBot.id]: { username: randomBot.username, color: randomBot.color, r: row, c: col }
      }));

      // Simulate typing a letter
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

      setGrid(prev => {
        const copy = prev.map(r => [...r]);
        copy[row][col] = randomLetter;
        return copy;
      });

      // Occasional solve simulation (15% chance per interval)
      if (Math.random() < 0.15) {
        const solution = board.solutions[randomClue.id];
        if (solution) {
          setTimeout(() => {
            // Solve it!
            setSolvedClues(prev => {
              if (prev.includes(randomClue.id)) return prev;
              const next = [...prev, randomClue.id];
              logSim(`${randomBot.username} resolveu a pista: "${randomClue.clueText}" -> "${solution}"`);
              
              // Fill grid
              setGrid(gCopy => {
                const g = gCopy.map(r => [...r]);
                for (let i = 0; i < randomClue.length; i++) {
                  const r = randomClue.direction === "horizontal" ? randomClue.startRow : randomClue.startRow + i;
                  const c = randomClue.direction === "horizontal" ? randomClue.startCol + i : randomClue.startCol;
                  g[r][c] = solution[i];
                }
                return g;
              });

              return next;
            });
          }, 500);
        }
      }
    }, 3000);

    return () => {
      clearTimeout(botJoinTimer);
      clearInterval(simActivityInterval);
    };
  }, [simulateMultiplayer, board, solvedClues, gameMode]);

  // Check if board solved in local co-op simulation
  useEffect(() => {
    if (board && solvedClues.length === board.clues.length && simulateMultiplayer) {
      setIsBoardCompleted(true);
      setCompletedStats({
        message: "O grupo simulador completou as cruzadas!",
        averageElo: board.averageElo
      });
      setSimulateMultiplayer(false);
    }
  }, [solvedClues, board]);

  // --- NOTIFICATION HANDLER ---
  const showToast = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const logSim = (message) => {
    setSimulatedLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 15)]);
  };

  // --- ACTIONS ---

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setIsLoggingIn(true);
    setTimeout(() => {
      setUser({
        id: "usr_" + Math.random().toString(36).substr(2, 9),
        username: usernameInput,
        elo: 1200,
        avatar: null
      });
      setIsLoggingIn(false);
      showToast(`Bem-vindo, ${usernameInput}! Perfil inicializado com sucesso.`, "success");
    }, 800);
  };

  const handleGoogleSimulate = () => {
    setShowGoogleSim(true);
    setTimeout(() => {
      setUser({
        id: "g_usr_" + Math.random().toString(36).substr(2, 9),
        username: "Google_Player_" + Math.floor(Math.random() * 1000),
        elo: 1280,
        email: "cruzadista.google@gmail.com"
      });
      setShowGoogleSim(false);
      showToast("Autenticado via Google com sucesso!", "success");
    }, 1500);
  };

  // Start Casual Game (Uses Offline pre-built templates for safety)
  const startCasualGame = () => {
    const generated = generateBoardForElo(user.elo, "template_7x7");
    setupNewGame(generated, "casual");
  };

  // Start Ranked Game (Uses dynamic backend matching or fallback generator matching ELO)
  const startRankedGame = () => {
    showToast("Gerando tabuleiro dinâmico personalizado para seu ELO...", "info");
    
    // Simulate slight loading for premium immersion
    setTimeout(() => {
      const generated = generateBoardForElo(user.elo, "template_10x10");
      setupNewGame(generated, "ranked");
      showToast(`Partida iniciada! Nível médio de dificuldade das palavras: ${generated.averageElo} ELO`, "info");
    }, 800);
  };

  // Create Room for Realtime Co-op
  const handleCreateRoom = async () => {
    if (socketConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId: user.id,
            hostName: user.username,
            hostElo: user.elo,
            mode: "casual"
          })
        });
        const data = await response.json();

        setRoomCode(data.roomId);
        setBoard(data.board);
        setGrid(data.gridState);
        setSolvedClues(data.solvedClues);
        setPlayers(data.players);
        setGameMode("group");
        setCurrentView("game");
        setIsBoardCompleted(false);

        // Join room WebSocket channel
        socketRef.current.emit("join_room", {
          roomId: data.roomId,
          userId: user.id,
          username: user.username,
          elo: user.elo
        });

        showToast(`Sala ${data.roomId} criada! Compartilhe o código com amigos.`, "success");
      } catch (err) {
        showToast("Erro ao conectar com servidor para criar sala. Ativando simulador local.", "error");
        activateLocalRoomSim();
      }
    } else {
      activateLocalRoomSim();
    }
  };

  // Activate dynamic local simulation room (if backend offline)
  const activateLocalRoomSim = () => {
    const generated = generateBoardForElo(user.elo, "template_10x10");
    setRoomCode("LOCAL");
    setupNewGame(generated, "group");
    setPlayers([
      { id: user.id, username: user.username, elo: user.elo, color: "#FF5733" }
    ]);
    setSimulateMultiplayer(true);
    showToast("Backend indisponível. Simulador Co-op ativado localmente para demonstração!", "warning");
  };

  // Join existing Room
  const handleJoinRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomInput.trim()) return;

    if (socketConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions/${roomInput.toUpperCase()}`);
        if (!response.ok) {
          showToast("Sala não encontrada.", "error");
          return;
        }
        const data = await response.json();

        setRoomCode(data.roomId);
        setBoard(data.board);
        setGrid(data.gridState);
        setSolvedClues(data.solvedClues);
        setPlayers(data.players);
        setGameMode("group");
        setCurrentView("game");
        setIsBoardCompleted(false);

        socketRef.current.emit("join_room", {
          roomId: data.roomId,
          userId: user.id,
          username: user.username,
          elo: user.elo
        });

        showToast(`Entrou na sala ${data.roomId}!`, "success");
      } catch (err) {
        showToast("Erro ao buscar sala.", "error");
      }
    } else {
      showToast("Não é possível conectar com o servidor para entrar em salas remotas.", "error");
    }
  };

  // Setup grid state variables
  const setupNewGame = (generatedBoard, mode) => {
    setBoard(generatedBoard);
    setGameMode(mode);
    
    // Create empty grid state matching template rows/cols
    const initialGrid = Array(generatedBoard.rows)
      .fill(null)
      .map(() => Array(generatedBoard.cols).fill(""));
    setGrid(initialGrid);
    
    setSolvedClues([]);
    setPlayers([{ id: user.id, username: user.username, elo: user.elo, color: "#FF5733" }]);
    setCurrentView("game");
    setIsBoardCompleted(false);
    setValidationStatuses({});
    setActiveCell(null);
    setActiveClue(null);
  };

  // --- GRID INTERACTION ---

  // Handle cell click / focus
  const handleCellClick = (r, c) => {
    if (board.matrix[r][c] === 0) {
      // Clue Cell clicked! Try to find mapped clue pointing from here
      const mappedClue = board.clues.find(clue => clue.clueRow === r && clue.clueCol === c);
      if (mappedClue) {
        setActiveClue(mappedClue);
        setTypingDirection(mappedClue.direction);
        setActiveCell({ r: mappedClue.startRow, c: mappedClue.startCol });
        focusInput(mappedClue.startRow, mappedClue.startCol);
      }
      return;
    }

    // Playable letter cell clicked
    setActiveCell({ r, c });

    // Determine target word direction based on overlapping clues
    const matchingClues = board.clues.filter(clue => {
      if (clue.direction === "horizontal") {
        return r === clue.startRow && c >= clue.startCol && c < clue.startCol + clue.length;
      } else {
        return c === clue.startCol && r >= clue.startRow && r < clue.startRow + clue.length;
      }
    });

    if (matchingClues.length > 0) {
      // Toggle direction if clicking the same cell twice
      let chosenClue = matchingClues[0];
      let newDirection = chosenClue.direction;

      if (activeCell && activeCell.r === r && activeCell.c === c) {
        const toggleClue = matchingClues.find(cl => cl.direction !== typingDirection);
        if (toggleClue) {
          chosenClue = toggleClue;
          newDirection = toggleClue.direction;
        }
      }

      setActiveClue(chosenClue);
      setTypingDirection(newDirection);

      // Emit cursor movement via socket in room play
      if (gameMode === "group" && socketConnected) {
        socketRef.current.emit("move_cursor", {
          roomId: roomCode,
          row: r,
          col: c,
          userId: user.id
        });
      }
    }
  };

  // Helper to focus input
  const focusInput = (r, c) => {
    const el = inputRefs.current[`${r}-${c}`];
    if (el) el.focus();
  };

  // Handle keystroke typing inside grid cell
  const handleCellChange = (r, c, val) => {
    if (isBoardCompleted) return;
    const letter = val.toUpperCase().slice(-1);
    if (!/^[A-ZÁÀÂÃÉÈÊÍÓÒÔÕÚÇ]$/.test(letter) && letter !== "") return;

    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = letter;
      return copy;
    });

    // Send cell update in multiplayer
    if (gameMode === "group" && socketConnected) {
      socketRef.current.emit("type_cell", {
        roomId: roomCode,
        row: r,
        col: c,
        letter,
        userId: user.id
      });
    }

    // Auto-advance cursor forward along the typing direction
    if (letter !== "" && activeClue) {
      const nextIndex = activeClue.direction === "horizontal" ? c - activeClue.startCol + 1 : r - activeClue.startRow + 1;
      if (nextIndex < activeClue.length) {
        const nextR = activeClue.direction === "horizontal" ? r : r + 1;
        const nextC = activeClue.direction === "horizontal" ? c + 1 : c;
        setActiveCell({ r: nextR, c: nextC });
        focusInput(nextR, nextC);
      }
    }
  };

  // Handle keyboard navigation (Backspace, arrows)
  const handleKeyDown = (r, c, e) => {
    if (!activeClue) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      // If current cell is empty, delete previous and move back
      if (grid[r][c] === "") {
        const prevIndex = activeClue.direction === "horizontal" ? c - activeClue.startCol - 1 : r - activeClue.startRow - 1;
        if (prevIndex >= 0) {
          const prevR = activeClue.direction === "horizontal" ? r : r - 1;
          const prevC = activeClue.direction === "horizontal" ? c - 1 : c;
          
          setGrid(prev => {
            const copy = prev.map(row => [...row]);
            copy[prevR][prevC] = "";
            return copy;
          });

          // Sync clear in group
          if (gameMode === "group" && socketConnected) {
            socketRef.current.emit("type_cell", {
              roomId: roomCode,
              row: prevR,
              col: prevC,
              letter: "",
              userId: user.id
            });
          }

          setActiveCell({ r: prevR, c: prevC });
          focusInput(prevR, prevC);
        }
      } else {
        // Just clear current cell
        setGrid(prev => {
          const copy = prev.map(row => [...row]);
          copy[r][c] = "";
          return copy;
        });

        if (gameMode === "group" && socketConnected) {
          socketRef.current.emit("type_cell", {
            roomId: roomCode,
            row: r,
            col: c,
            letter: "",
            userId: user.id
          });
        }
      }
    } else if (e.key === "ArrowRight" && c + 1 < board.cols && board.matrix[r][c+1] === 1) {
      e.preventDefault();
      handleCellClick(r, c + 1);
      focusInput(r, c + 1);
    } else if (e.key === "ArrowLeft" && c - 1 >= 0 && board.matrix[r][c-1] === 1) {
      e.preventDefault();
      handleCellClick(r, c - 1);
      focusInput(r, c - 1);
    } else if (e.key === "ArrowDown" && r + 1 < board.rows && board.matrix[r+1][c] === 1) {
      e.preventDefault();
      handleCellClick(r + 1, c);
      focusInput(r + 1, c);
    } else if (e.key === "ArrowUp" && r - 1 >= 0 && board.matrix[r-1][c] === 1) {
      e.preventDefault();
      handleCellClick(r - 1, c);
      focusInput(r - 1, c);
    }
  };

  // --- VALIDATION AND GAME LOGIC ---

  // Check if a specific clue's typed letters form the correct word
  const submitWordForClue = (clue) => {
    if (solvedClues.includes(clue.id)) return;

    // Collect letters typed in the grid for this word
    let attempt = "";
    for (let i = 0; i < clue.length; i++) {
      const r = clue.direction === "horizontal" ? clue.startRow : clue.startRow + i;
      const c = clue.direction === "horizontal" ? clue.startCol + i : clue.startCol;
      attempt += grid[r][c] || "";
    }

    if (attempt.length < clue.length) {
      showToast("Por favor, preencha a palavra inteira antes de enviar.", "warning");
      return;
    }

    if (gameMode === "group" && socketConnected) {
      // Remote WebSocket validation
      socketRef.current.emit("submit_word", {
        roomId: roomCode,
        clueId: clue.id,
        attempt,
        userId: user.id
      });
    } else {
      // Standalone Local validation engine
      const correctWord = board.solutions[clue.id];
      const cleanAttempt = attempt.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cleanSolution = correctWord.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (cleanAttempt === cleanSolution) {
        setSolvedClues(prev => {
          const next = [...prev, clue.id];
          setValidationStatuses(prevS => ({ ...prevS, [clue.id]: "correct" }));
          
          let eloText = "";
          if (gameMode === "ranked") {
            const dictWord = localWords.find(w => w.word === correctWord);
            if (dictWord) {
              const { newPlayerRating, newWordRating } = updateRatings(user.elo, dictWord.elo, 1.0);
              const playerEloChange = newPlayerRating - user.elo;
              
              setUser(prevU => ({ ...prevU, elo: newPlayerRating }));
              dictWord.elo = newWordRating;
              setLocalWords([...localWords]);
              eloText = ` (+${playerEloChange} ELO)`;
            }
          }

          showToast(`Correto! Resolveu a palavra "${correctWord}"!${eloText}`, "success");

          // Check if board fully solved
          if (next.length === board.clues.length) {
            setIsBoardCompleted(true);
            setCompletedStats({
              message: "Parabéns! Você resolveu todo o tabuleiro!",
              averageElo: board.averageElo
            });
            if (simulateMultiplayer) setSimulateMultiplayer(false);
          }

          return next;
        });
      } else {
        setValidationStatuses(prevS => ({ ...prevS, [clue.id]: "incorrect" }));
        
        let eloText = "";
        if (gameMode === "ranked") {
          const dictWord = localWords.find(w => w.word === correctWord);
          if (dictWord) {
            const { newPlayerRating, newWordRating } = updateRatings(user.elo, dictWord.elo, 0.0);
            const playerEloChange = newPlayerRating - user.elo;
            
            setUser(prevU => ({ ...prevU, elo: newPlayerRating }));
            dictWord.elo = newWordRating;
            setLocalWords([...localWords]);
            eloText = ` (${playerEloChange} ELO)`;
          }
        }

        showToast(`Incorreto! Tente novamente.${eloText}`, "error");

        // Clear error color
        setTimeout(() => {
          setValidationStatuses(prevS => ({ ...prevS, [clue.id]: null }));
        }, 2000);
      }
    }
  };

  // Helper to reveal a clue cell (Hint)
  const handleRevealClueHint = (clue) => {
    if (solvedClues.includes(clue.id)) return;
    
    // Hint penalty in ranked
    if (gameMode === "ranked") {
      setUser(prev => ({ ...prev, elo: Math.max(100, prev.elo - 10) }));
      showToast("Dica revelada! Penanalidade de -10 ELO.", "warning");
    }

    const solution = board.solutions[clue.id];
    
    // Copy the first letters of the solution to the grid
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      for (let i = 0; i < clue.length; i++) {
        const r = clue.direction === "horizontal" ? clue.startRow : clue.startRow + i;
        const c = clue.direction === "horizontal" ? clue.startCol + i : clue.startCol;
        copy[r][c] = solution[i]; // Complete cell
      }
      return copy;
    });

    setSolvedClues(prev => [...prev, clue.id]);
    setValidationStatuses(prev => ({ ...prev, [clue.id]: "correct" }));
    showToast(`Pista revelada: "${solution}"`, "info");
  };

  // Leave Session game
  const leaveGame = () => {
    if (gameMode === "group" && socketConnected && roomCode !== "LOCAL") {
      socketRef.current.emit("leave_room", { roomId: roomCode, userId: user.id });
    }
    setBoard(null);
    setSolvedClues([]);
    setValidationStatuses({});
    setIsBoardCompleted(false);
    setCompletedStats(null);
    setSimulateMultiplayer(false);
    setCurrentView("dashboard");
  };

  // League Calculator
  const getLeagueTier = (elo) => {
    if (elo < 1000) return { name: "Bronze", color: "#cd7f32" };
    if (elo < 1200) return { name: "Prata", color: "#c0c0c0" };
    if (elo < 1400) return { name: "Ouro", color: "#ffd700" };
    if (elo < 1600) return { name: "Platina", color: "#e5e4e2" };
    if (elo < 1850) return { name: "Diamante", color: "#b9f2ff" };
    return { name: "Mestre", color: "#a855f7" };
  };

  // --- RENDER HELPERS ---

  const activeLeague = user ? getLeagueTier(user.elo) : null;

  return (
    <div className="app-container fade-in-up">
      {/* Toast Notification */}
      {notification && (
        <div className={`toast-banner ${notification.type}`}>
          {notification.type === "success" && <Check size={18} />}
          {notification.type === "error" && <X size={18} />}
          {notification.type === "warning" && <HelpCircle size={18} />}
          {notification.type === "info" && <Sparkles size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 1. LOGIN VIEW */}
      {!user && (
        <div className="login-screen glass-panel">
          <div className="logo-section">
            <div className="logo-icon">C</div>
            <h1>Cruzadas<span style={{ color: "#a855f7" }}>Diretas</span></h1>
            <p>Sistema Ranqueado & Co-op em Tempo Real</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="input-group">
              <label>Nome do Jogador</label>
              <input 
                type="text" 
                placeholder="Ex: Pedro_Gamer" 
                value={usernameInput} 
                onChange={(e) => setUsernameInput(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="primary" disabled={isLoggingIn}>
              {isLoggingIn ? <RefreshCw className="spin" size={18} /> : <LogIn size={18} />}
              Entrar no Arena
            </button>
          </form>

          <div className="divider"><span>ou continue com</span></div>

          <button onClick={handleGoogleSimulate} className="google-btn">
            {showGoogleSim ? (
              <RefreshCw className="spin" size={18} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.8 2.72v2.24h2.9c1.7-1.57 2.7-3.88 2.7-6.59z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.59-5.05-3.73H.95v2.3C2.43 15.93 5.48 18 9 18z"/>
                <path fill="#FBBC05" d="M3.95 10.7c-.18-.54-.28-1.12-.28-1.7s.1-1.16.28-1.7V5H.95A8.99 8.99 0 0 0 0 9c0 1.48.36 2.89.95 4.14l3-2.44z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.4C13.46.99 11.42 0 9 0 5.48 0 2.43 2.07.95 5.03l3 2.44c.71-2.14 2.7-3.73 5.05-3.73z"/>
              </svg>
            )}
            Conectar com Google Account
          </button>
        </div>
      )}

      {/* 2. MAIN APPLICATION CONTENT */}
      {user && (
        <div className="main-layout">
          
          {/* TOP HEADER */}
          <header className="main-header glass-panel">
            <div className="header-brand">
              <div className="logo-icon-sm">C</div>
              <div>
                <h2>Cruzadas <span className="gradient-text">Ranqueadas</span></h2>
                <div className="server-status">
                  <span className={`status-dot ${socketConnected ? "online" : "offline"}`}></span>
                  <small>{socketConnected ? "Servidor Remoto Conectado" : "Motor Standalone Local Ativo"}</small>
                </div>
              </div>
            </div>

            <div className="theme-selector-panel">
              <button 
                className={`theme-btn ${theme === "light" ? "active" : ""}`} 
                onClick={() => setTheme("light")}
                title="Modo Claro"
              >
                <Sun size={15} />
                <span>Claro</span>
              </button>
              <button 
                className={`theme-btn ${theme === "dark" ? "active" : ""}`} 
                onClick={() => setTheme("dark")}
                title="Modo Escuro"
              >
                <Moon size={15} />
                <span>Escuro</span>
              </button>
              <button 
                className={`theme-btn ${theme === "newspaper" ? "active" : ""}`} 
                onClick={() => setTheme("newspaper")}
                title="Modo Jornal"
              >
                <BookOpen size={15} />
                <span>Jornal</span>
              </button>
            </div>

            <div className="user-profile-badge">
              <div className="user-info-text">
                <span className="username">{user.username}</span>
                <span className="league-tier" style={{ color: activeLeague?.color }}>
                  Liga {activeLeague?.name}
                </span>
              </div>
              <div className="elo-circle" style={{ borderColor: activeLeague?.color }}>
                <Trophy size={16} style={{ color: activeLeague?.color }} />
                <span>{user.elo}</span>
              </div>
              <button onClick={() => setUser(null)} className="logout-btn" title="Sair">
                <LogOut size={16} />
              </button>
            </div>
          </header>

          {/* VIEW: DASHBOARD */}
          {currentView === "dashboard" && (
            <div className="dashboard-grid">
              
              {/* Left Profile Panel */}
              <div className="profile-card glass-panel fade-in-up">
                <div className="avatar-shield" style={{ boxShadow: `0 0 20px ${activeLeague?.color}33` }}>
                  <Award size={64} style={{ color: activeLeague?.color }} />
                </div>
                <h3>{user.username}</h3>
                <p className="elo-sub">{user.elo} ELO points</p>

                <div className="stat-row">
                  <span>Liga Atual</span>
                  <strong style={{ color: activeLeague?.color }}>{activeLeague?.name}</strong>
                </div>
                <div className="stat-row">
                  <span>Partidas Jogadas</span>
                  <strong>12</strong>
                </div>
                <div className="stat-row">
                  <span>Precisão Média</span>
                  <strong>84%</strong>
                </div>

                <div className="league-bar-container">
                  <div className="league-bar-header">
                    <small>Próxima Liga</small>
                    <small>{user.elo} / 1400</small>
                  </div>
                  <div className="progress-bg">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${Math.min(100, (user.elo / 1400) * 100)}%`, background: activeLeague?.color }}
                    ></div>
                  </div>
                </div>

                <button onClick={() => setShowDictionary(!showDictionary)} className="dictionary-toggle-btn">
                  <Sparkles size={16} />
                  Ver Dicionário de Palavras ELO
                </button>
              </div>

              {/* Right Game Modes Panel */}
              <div className="modes-panel fade-in-up" style={{ animationDelay: "0.1s" }}>
                <div className="panel-header">
                  <h3>Escolha seu Modo de Jogo</h3>
                  <p>Treine sem compromisso ou dispute posições no ranking</p>
                </div>

                <div className="modes-grid">
                  
                  {/* Mode Card 1: Casual */}
                  <div className="mode-card glass-panel" onClick={startCasualGame}>
                    <div className="mode-icon casual">
                      <Play size={24} />
                    </div>
                    <div>
                      <h4>Treino Casual</h4>
                      <p>Jogue tabuleiros pré-calculados perfeitamente balanceados sem alterar seu ELO.</p>
                    </div>
                    <ArrowRight className="arrow-hover" />
                  </div>

                  {/* Mode Card 2: Ranked */}
                  <div className="mode-card glass-panel" onClick={startRankedGame}>
                    <div className="mode-icon ranked">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <h4>Partida Ranqueada Solo</h4>
                      <p>O backend gera dinamicamente cruzadas com palavras próximas ao seu ELO. Ganhe ou perca pontos!</p>
                    </div>
                    <ArrowRight className="arrow-hover" />
                  </div>

                  {/* Mode Card 3: Multiplayer */}
                  <div className="mode-card glass-panel">
                    <div className="mode-icon group">
                      <Users size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4>Jogar em Grupo (Co-op)</h4>
                      <p>Crie uma sala cooperativa para resolver o mesmo tabuleiro junto com seus amigos em tempo real.</p>
                      
                      <div className="group-buttons-row">
                        <button onClick={handleCreateRoom} className="primary">
                          <Plus size={16} /> Criar Sala
                        </button>
                        
                        <form onSubmit={handleJoinRoomSubmit} className="join-form-inline">
                          <input 
                            type="text" 
                            placeholder="CÓDIGO" 
                            maxLength={4}
                            value={roomInput} 
                            onChange={(e) => setRoomInput(e.target.value)}
                          />
                          <button type="submit">Entrar</button>
                        </form>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* VIEW: GAME PLAY AREA */}
          {currentView === "game" && board && (
            <div className="game-grid-layout fade-in-up">
              
              {/* Left Column: Grid Board */}
              <div className="board-section glass-panel">
                
                {/* Board Info Bar */}
                <div className="board-header">
                  <button onClick={leaveGame} className="back-btn">
                    Voltar ao Dashboard
                  </button>
                  <div className="game-meta">
                    <span className="badge-mode">{gameMode === "casual" ? "Casual" : gameMode === "ranked" ? "Ranqueado" : "Grupo Cooperativo"}</span>
                    {gameMode === "group" && (
                      <span className="badge-room">
                        <Hash size={14} /> SALA: {roomCode}
                      </span>
                    )}
                    <span className="badge-difficulty">Dificuldade Média: {board.averageElo} ELO</span>
                  </div>
                </div>

                {/* THE CROSSWORD GRID CONTAINER */}
                <div className="crossword-container">
                  <div 
                    className="grid-board"
                    style={{
                      gridTemplateColumns: `repeat(${board.cols}, minmax(36px, 1fr))`,
                      gridTemplateRows: `repeat(${board.rows}, minmax(36px, 1fr))`,
                    }}
                  >
                    {grid.map((row, r) => 
                      row.map((cellLetter, c) => {
                        const cellType = board.matrix[r][c];
                        const isPlayable = cellType === 1;

                        // Check if this cell is part of active word highlight
                        let isHighlighted = false;
                        if (isPlayable && activeClue) {
                          const cl = activeClue;
                          if (cl.direction === "horizontal") {
                            isHighlighted = r === cl.startRow && c >= cl.startCol && c < cl.startCol + cl.length;
                          } else {
                            isHighlighted = c === cl.startCol && r >= cl.startRow && r < cl.startRow + cl.length;
                          }
                        }

                        const isActive = activeCell && activeCell.r === r && activeCell.c === c;

                        // Check if cell solved
                        const solvedClueIds = board.clues
                          .filter(cl => {
                            if (cl.direction === "horizontal") {
                              return r === cl.startRow && c >= cl.startCol && c < cl.startCol + cl.length;
                            } else {
                              return c === cl.startCol && r >= cl.startRow && r < cl.startRow + cl.length;
                            }
                          })
                          .map(cl => cl.id);
                        
                        const isSolved = solvedClueIds.some(id => solvedClues.includes(id));

                        // Find if there is a clue box starting in this cell (type 0)
                        const clueBox = board.clues.find(cl => cl.clueRow === r && cl.clueCol === c);

                        let tooltipClass = "";
                        if (clueBox) {
                          if (clueBox.direction === "vertical") {
                            const isNearRightEdge = c >= board.cols - 2;
                            tooltipClass = isNearRightEdge ? "vertical-clue-tooltip tooltip-left" : "vertical-clue-tooltip";
                          } else {
                            tooltipClass = r <= 1 ? "top-row-tooltip" : "";
                          }
                        }

                        // Find remote cursors
                        const playersAtCell = Object.values(remoteCursors).filter(cur => cur.r === r && cur.c === c);

                        if (!isPlayable) {
                          // RENDER CLUE BOX CELL (0)
                          return (
                            <div 
                              key={`${r}-${c}`} 
                              className={`cell-clue ${clueBox ? "has-clue" : ""}`}
                              onClick={() => clueBox && handleCellClick(r, c)}
                            >
                              {clueBox && (
                                <>
                                  <div className="clue-inner">
                                    <span className="clue-abbrev-text">{clueBox.clueText.slice(0, 10)}...</span>
                                    {clueBox.arrowDirection === "right" ? (
                                      <ArrowRight size={14} className="arrow-glow right" />
                                    ) : (
                                      <ArrowDown size={14} className="arrow-glow down" />
                                    )}
                                  </div>

                                  {/* Floating Clue Tooltip Popup */}
                                  <div className={`clue-tooltip-popup glass-panel ${tooltipClass}`}>
                                    <div className="tooltip-header">
                                      <span className="direction-tag">
                                        {clueBox.direction === "horizontal" ? "Horiz." : "Vert."} ({clueBox.length} letras)
                                      </span>
                                    </div>
                                    <p className="tooltip-text">"{clueBox.clueText}"</p>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        }

                        // RENDER LETTER INPUT CELL (1)
                        const inputKey = `${r}-${c}`;
                        return (
                          <div 
                            key={inputKey} 
                            className={`cell-letter 
                              ${isHighlighted ? "highlighted" : ""} 
                              ${isActive ? "active" : ""}
                              ${isSolved ? "solved" : ""}
                            `}
                            onClick={() => handleCellClick(r, c)}
                          >
                            <input
                              ref={el => { inputRefs.current[inputKey] = el; }}
                              type="text"
                              maxLength={1}
                              value={cellLetter}
                              disabled={isSolved || isBoardCompleted}
                              onChange={(e) => handleCellChange(r, c, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(r, c, e)}
                            />

                            {/* Multiplayer floating cursors */}
                            {playersAtCell.map(cur => (
                              <div 
                                key={cur.username}
                                className="remote-cursor-indicator"
                                style={{ borderColor: cur.color }}
                              >
                                <span className="tooltip-cursor" style={{ backgroundColor: cur.color }}>
                                  {cur.username}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Clues List and Players Card */}
              <div className="details-section">
                
                {/* Collaborative Session List */}
                <div className="players-card glass-panel">
                  <div className="card-header-icon">
                    <Users size={18} />
                    <h4>Jogadores na Sala ({players.length})</h4>
                  </div>
                  
                  <div className="players-list-scroll">
                    {players.map(p => {
                      const tier = getLeagueTier(p.elo);
                      return (
                        <div key={p.id} className="player-list-item">
                          <div className="player-indicator-bullet" style={{ backgroundColor: p.color || "#FF5733" }}></div>
                          <div style={{ flex: 1 }}>
                            <strong>{p.username} {p.id === user.id ? "(Você)" : ""}</strong>
                            <small style={{ color: tier.color, marginLeft: 8 }}>{tier.name}</small>
                          </div>
                          <span className="player-elo-badge">{p.elo} ELO</span>
                        </div>
                      );
                    })}
                  </div>

                  {gameMode === "group" && roomCode === "LOCAL" && (
                    <button 
                      onClick={() => setSimulateMultiplayer(!simulateMultiplayer)} 
                      className={`primary ${simulateMultiplayer ? "active" : ""}`}
                      style={{ marginTop: 12, width: "100%" }}
                    >
                      <Sparkles size={16} />
                      {simulateMultiplayer ? "Parar Simulação Co-op" : "Simular Amigos Jogando"}
                    </button>
                  )}
                </div>

                {/* Active Clue Panel */}
                <div className="active-clue-panel glass-panel">
                  <h4>Dica Selecionada</h4>
                  {activeClue ? (
                    <div className="clue-detail-body fade-in-up">
                      <div className="clue-meta-row">
                        <span className="clue-direction-badge">
                          {activeClue.direction === "horizontal" ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
                          {activeClue.direction === "horizontal" ? "Horizontal" : "Vertical"}
                        </span>
                        <span>Tamanho: {activeClue.length} letras</span>
                      </div>
                      <p className="clue-main-text">"{activeClue.clueText}"</p>

                      <div className="clue-action-buttons">
                        <button 
                          onClick={() => submitWordForClue(activeClue)} 
                          className="primary"
                          disabled={solvedClues.includes(activeClue.id) || isBoardCompleted}
                        >
                          <Check size={16} /> Validar Palavra
                        </button>
                        <button 
                          onClick={() => handleRevealClueHint(activeClue)} 
                          className="hint-btn"
                          disabled={solvedClues.includes(activeClue.id) || isBoardCompleted}
                        >
                          <HelpCircle size={16} /> Revelar Dica
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="clue-placeholder">Selecione uma caixa de dica ou célula do grid para começar a preencher.</p>
                  )}
                </div>

                {/* All Clues Checklist */}
                <div className="clues-checklist-panel glass-panel">
                  <h4>Lista de Pistas ({solvedClues.length}/{board.clues.length})</h4>
                  <div className="clues-list-scroll">
                    {board.clues.map(cl => {
                      const isSolved = solvedClues.includes(cl.id);
                      const isSelected = activeClue && activeClue.id === cl.id;
                      return (
                        <div 
                          key={cl.id} 
                          className={`clue-check-item ${isSolved ? "solved" : ""} ${isSelected ? "selected" : ""}`}
                          onClick={() => handleCellClick(cl.clueRow, cl.clueCol)}
                        >
                          <div className={`check-indicator ${isSolved ? "checked" : ""}`}>
                            {isSolved && <Check size={12} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p className="clue-txt">"{cl.clueText}"</p>
                            <span className="clue-dir-span">
                              {cl.direction === "horizontal" ? "Horiz." : "Vert."} • {cl.length} letras
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* SIMULATION PANEL (If active) */}
          {simulateMultiplayer && gameMode === "group" && (
            <div className="simulation-log-panel glass-panel fade-in-up">
              <div className="sim-header">
                <Sparkles size={16} className="text-glow" />
                <h4>Painel de Simulação Co-op Ativo</h4>
              </div>
              <p>Este painel simula outros cruzadistas digitando e resolvendo palavras na mesma sala em tempo real via socket local.</p>
              <div className="sim-logs-container">
                {simulatedLogs.length === 0 && <small className="placeholder">Aguardando atividades dos simuladores...</small>}
                {simulatedLogs.map((log, index) => (
                  <div key={index} className="sim-log-row">{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: BOARD SOLVED FULL SCREEN OVERLAY */}
          {isBoardCompleted && completedStats && (
            <div className="overlay-solved fade-in-up">
              <div className="solved-card glass-panel">
                <div className="sparkles-container">
                  <Sparkles size={64} className="star-pulse" style={{ color: "#ffd700" }} />
                </div>
                <h2>Parabéns! Grid Resolvido!</h2>
                <p>{completedStats.message}</p>
                <div className="average-rating-badge">
                  Dificuldade Média do Grid: {completedStats.averageElo} ELO
                </div>

                <div className="elo-updated-card">
                  <Trophy size={32} style={{ color: "#ffd700" }} />
                  <div>
                    <h4>Novo Rating do Perfil</h4>
                    <p style={{ fontSize: "2rem", fontWeight: "800", color: "#ffd700", margin: "4px 0" }}>
                      {user.elo} ELO
                    </p>
                    <small>Liga: {getLeagueTier(user.elo).name}</small>
                  </div>
                </div>

                <button onClick={leaveGame} className="primary" style={{ width: "100%", justifyContent: "center" }}>
                  Voltar ao Painel Principal
                </button>
              </div>
            </div>
          )}

          {/* VIEW: DICTIONARY VIEWER (ELO WEIGHTS) */}
          {showDictionary && (
            <div className="overlay-solved fade-in-up" style={{ zIndex: 100 }}>
              <div className="solved-card glass-panel" style={{ maxWidth: "600px", width: "90%" }}>
                <div className="modal-header">
                  <h3>Dicionário de Palavras Ranqueadas (ELO)</h3>
                  <button onClick={() => setShowDictionary(false)} className="close-btn"><X size={18} /></button>
                </div>
                <p>Veja como as palavras se auto-calibram baseando-se nas tentativas dos jogadores e em suas propriedades linguísticas:</p>

                <div className="dictionary-table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Palavra</th>
                        <th>Dificuldade (ELO)</th>
                        <th>Sucessos / Tentativas</th>
                        <th>Métrica</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localWords.map(w => (
                        <tr key={w.id}>
                          <td><strong>{w.word}</strong></td>
                          <td><span className="table-elo">{w.elo}</span></td>
                          <td>{w.solves} / {w.attempts}</td>
                          <td>
                            <small className="badge-tier" style={{ backgroundColor: getLeagueTier(w.elo).color + "22", color: getLeagueTier(w.elo).color }}>
                              {getLeagueTier(w.elo).name}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button onClick={() => setShowDictionary(false)} className="primary" style={{ marginTop: 16 }}>
                  Fechar Dicionário
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default App;
