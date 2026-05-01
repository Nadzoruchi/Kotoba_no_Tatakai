import { Hono } from "hono";
import { serveStatic, upgradeWebSocket, websocket } from "hono/bun";

const app = new Hono();

// --- Game State ---
let gameState = {
  status: "waiting", // waiting | playing | finished
  currentWord: "",
  usedWords: [],
  players: [],
  currentTurnIndex: 0,
  turnTimeLimit: 15, // seconds
  turnTimer: null,
  round: 0,
};

const clients = new Map(); // ws.raw -> { ws, username, role, score, isAlive }

// --- Broadcast Helpers ---
function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const [, client] of clients) {
    client.ws.send(payload);
  }
}

function broadcastGameState() {
  broadcast({
    type: "GAME_STATE",
    state: {
      status: gameState.status,
      currentWord: gameState.currentWord,
      usedWords: gameState.usedWords,
      players: gameState.players.map((p) => ({
        username: p.username,
        score: p.score,
        isAlive: p.isAlive,
      })),
      currentTurn:
        gameState.players[gameState.currentTurnIndex]?.username || null,
      round: gameState.round,
    },
  });
}

// --- Game Logic ---
function getLastChar(word) {
  return word.charAt(word.length - 1).toLowerCase();
}

function isValidWord(newWord) {
  if (!newWord || newWord.trim().length < 2)
    return { ok: false, reason: "Kata terlalu pendek (minimal 2 huruf)." };
  const w = newWord.trim().toLowerCase();
  if (gameState.usedWords.includes(w))
    return { ok: false, reason: `Kata "${w}" sudah pernah dipakai!` };
  if (gameState.currentWord) {
    const lastChar = getLastChar(gameState.currentWord);
    if (w.charAt(0) !== lastChar)
      return {
        ok: false,
        reason: `Kata harus diawali huruf "${lastChar.toUpperCase()}"!`,
      };
  }
  return { ok: true };
}

function startTurnTimer() {
  clearTurnTimer();
  gameState.turnTimer = setTimeout(() => {
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    if (!currentPlayer) return;
    // Player timeout - eliminate them
    currentPlayer.isAlive = false;
    broadcast({
      type: "PLAYER_TIMEOUT",
      username: currentPlayer.username,
    });
    advanceTurn();
  }, gameState.turnTimeLimit * 1000);
}

function clearTurnTimer() {
  if (gameState.turnTimer) {
    clearTimeout(gameState.turnTimer);
    gameState.turnTimer = null;
  }
}

function getAlivePlayers() {
  return gameState.players.filter((p) => p.isAlive);
}

function advanceTurn() {
  const alive = getAlivePlayers();
  if (alive.length <= 1) {
    endGame();
    return;
  }

  // Move to next alive player
  let nextIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
  while (!gameState.players[nextIndex].isAlive) {
    nextIndex = (nextIndex + 1) % gameState.players.length;
  }
  gameState.currentTurnIndex = nextIndex;
  gameState.round++;

  broadcastGameState();
  broadcast({
    type: "YOUR_TURN",
    username: gameState.players[nextIndex].username,
    lastWord: gameState.currentWord,
    mustStartWith: gameState.currentWord
      ? getLastChar(gameState.currentWord)
      : null,
    timeLimit: gameState.turnTimeLimit,
  });
  startTurnTimer();
}

function endGame() {
  clearTurnTimer();
  gameState.status = "finished";
  const alive = getAlivePlayers();
  const winner = alive.length === 1 ? alive[0] : null;

  // Sort leaderboard by score
  const leaderboard = [...gameState.players].sort((a, b) => b.score - a.score);

  broadcast({
    type: "GAME_OVER",
    winner: winner ? winner.username : "Seri",
    leaderboard: leaderboard.map((p) => ({
      username: p.username,
      score: p.score,
    })),
  });
}

function resetGame() {
  clearTurnTimer();
  gameState = {
    status: "waiting",
    currentWord: "",
    usedWords: [],
    players: [],
    currentTurnIndex: 0,
    turnTimeLimit: 15,
    turnTimer: null,
    round: 0,
  };
  // Re-register connected clients as fresh players
  for (const [, client] of clients) {
    gameState.players.push({
      username: client.username,
      score: 0,
      isAlive: true,
    });
    client.score = 0;
  }
}

// --- Routes ---
app.use("/client", serveStatic({ path: "./public/index.html" }));

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen(_, ws) {
      clients.set(ws.raw, { ws, username: "Anonymous", score: 0 });
    },

    onMessage(event, ws) {
      const client = clients.get(ws.raw);
      if (!client) return;

      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      // JOIN
      if (data.type === "JOIN") {
        const username = (data.username || "").trim();
        if (!username) return;
        client.username = username;
        console.log(`[JOIN] ${username}`);

        // Add to player list if not already there
        if (!gameState.players.find((p) => p.username === username)) {
          gameState.players.push({ username, score: 0, isAlive: true });
        }

        broadcast({ type: "PLAYER_JOINED", username });
        broadcastGameState();

        // Send personal welcome
        ws.send(
          JSON.stringify({
            type: "WELCOME",
            username,
            message: `Selamat datang, ${username}!`,
          }),
        );
      }

      // HOST: START GAME
      if (data.type === "START_GAME") {
        if (gameState.status !== "waiting") return;
        if (gameState.players.length < 2) {
          ws.send(
            JSON.stringify({
              type: "ERROR",
              message: "Butuh minimal 2 pemain untuk mulai!",
            }),
          );
          return;
        }
        gameState.status = "playing";
        gameState.currentWord = "";
        gameState.usedWords = [];
        gameState.round = 1;
        gameState.currentTurnIndex = 0;
        // Reset all alive
        gameState.players.forEach((p) => {
          p.isAlive = true;
          p.score = 0;
        });

        broadcast({
          type: "GAME_STARTED",
          message: "Game Sambung Kata dimulai!",
        });
        broadcastGameState();

        const firstPlayer = gameState.players[0];
        broadcast({
          type: "YOUR_TURN",
          username: firstPlayer.username,
          lastWord: null,
          mustStartWith: null,
          timeLimit: gameState.turnTimeLimit,
        });
        startTurnTimer();
      }

      // SUBMIT WORD
      if (data.type === "SUBMIT_WORD") {
        if (gameState.status !== "playing") return;

        const currentPlayer = gameState.players[gameState.currentTurnIndex];
        if (!currentPlayer || currentPlayer.username !== client.username) {
          ws.send(
            JSON.stringify({ type: "ERROR", message: "Bukan giliran kamu!" }),
          );
          return;
        }

        const word = (data.word || "").trim().toLowerCase();
        const validation = isValidWord(word);

        if (!validation.ok) {
          ws.send(
            JSON.stringify({
              type: "WORD_REJECTED",
              reason: validation.reason,
            }),
          );
          return;
        }

        // Accept word
        clearTurnTimer();
        gameState.usedWords.push(word);
        gameState.currentWord = word;

        // Score: +10 per word, bonus for long words
        const points = 10 + Math.max(0, word.length - 4) * 2;
        currentPlayer.score += points;

        broadcast({
          type: "WORD_ACCEPTED",
          username: client.username,
          word,
          points,
          score: currentPlayer.score,
          nextChar: getLastChar(word),
        });

        advanceTurn();
      }

      // RESET GAME
      if (data.type === "RESET_GAME") {
        resetGame();
        broadcast({
          type: "GAME_RESET",
          message: "Game direset. Tunggu host untuk memulai lagi.",
        });
        broadcastGameState();
      }
    },

    onClose(_, ws) {
      const client = clients.get(ws.raw);
      if (client) {
        console.log(`[DISCONNECT] ${client.username}`);
        gameState.players = gameState.players.filter(
          (p) => p.username !== client.username,
        );
        clients.delete(ws.raw);
        broadcast({ type: "PLAYER_LEFT", username: client.username });
        broadcastGameState();
        // If game ongoing and not enough players
        if (gameState.status === "playing" && getAlivePlayers().length <= 1) {
          endGame();
        }
      }
    },
  })),
);

export default {
  port: 3001,
  fetch: app.fetch,
  websocket,
};
