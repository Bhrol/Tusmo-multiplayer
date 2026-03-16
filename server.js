import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

import { pickWord, isValidWord, normalizeGuess } from "./server/wordStore.js";
import { buildRoomState } from "./server/roomState.js";
import { startNewWord } from "./server/roomLogic.js";
import { assignGuestName, generateCode, normalizeCode } from "./server/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_ATTEMPTS = 6;

/**
 * Compute Wordle-style result codes: 2=correct, 1=present, 0=absent.
 * @param {string} guess
 * @param {string} target
 * @returns {number[]}
 */
function computeResult(guess, target) {
  const result = Array(guess.length).fill(0);
  const targetChars = target.split("");
  const used = Array(target.length).fill(false);

  for (let i = 0; i < guess.length; i += 1) {
    if (guess[i] === target[i]) {
      result[i] = 2;
      used[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i += 1) {
    if (result[i] !== 0) continue;
    const idx = targetChars.findIndex((ch, j) => ch === guess[i] && !used[j]);
    if (idx !== -1) {
      result[i] = 1;
      used[idx] = true;
    }
  }

  return result;
}

/**
 * Send a tailored room state to each connected player.
 * @param {object} room
 */
function emitRoomState(room) {
  room.players.forEach((player) => {
    io.to(player.id).emit("room_state", buildRoomState(room, player.id, MAX_ATTEMPTS));
  });
}

/**
 * Advance to the next word once every player is done.
 * @param {object} room
 */
function checkAdvance(room) {
  if (room.gameOver || !room.started) return;
  if (room.settings.mode === "sync") {
    const allDone = Array.from(room.players.values()).every((p) => p.status === "done");
    if (allDone) {
      recordSyncHistory(room);
      startNewWord(room, pickWord);
      emitRoomState(room);
      if (room.gameOver) {
        finalizePodium(room);
      }
      io.to(room.code).emit("room_message", {
        text: room.gameOver
          ? "Game over!"
          : `Next word ${room.wordIndex + 1}/${room.settings.wordCount}`
      });
    }
    return;
  }

  const allFinished = Array.from(room.players.values()).every((p) => p.finished);
  if (allFinished) {
    room.gameOver = true;
    finalizePodium(room);
    emitRoomState(room);
  }
}

function buildLengthSequence(settings, initialLength) {
  const lengths = [];
  let current = initialLength;
  for (let i = 0; i < settings.wordCount; i += 1) {
    if (i > 0) {
      if (settings.lengthMode === "fixed") {
        current = settings.fixedLength;
      } else {
        current = current + 1 > settings.maxLength ? settings.minLength : current + 1;
      }
    }
    lengths.push(current);
  }
  return lengths;
}

function buildWordList(room) {
  const list = [];
  for (let i = 0; i < room.wordLengths.length; i += 1) {
    const word = pickWord(room.wordLengths[i], room.settings.language);
    if (!word) return null;
    list.push(word);
  }
  return list;
}

function advancePlayerWord(room, player) {
  pushHistory(player);
  player.wordIndex += 1;
  if (player.wordIndex >= room.settings.wordCount) {
    player.status = "done";
    player.finished = true;
    player.endTime = Date.now();
    return;
  }
  player.currentLength = room.wordLengths[player.wordIndex];
  player.targetWord = room.wordList[player.wordIndex];
  player.firstLetter = player.targetWord ? player.targetWord[0] : "";
  player.attempts = [];
  player.status = "playing";
}

function finalizePodium(room) {
  const now = Date.now();
  const podium = Array.from(room.players.values()).map((p) => {
    if (!p.startTime) {
      p.startTime = now;
    }
    if (!p.endTime) {
      p.endTime = now;
    }
    p.finished = true;
    return {
      name: p.name,
      totalAttempts: p.totalAttempts,
      totalTimeMs: p.endTime - p.startTime
    };
  });
  if (room.settings.mode === "timed") {
    podium.sort((a, b) => a.totalTimeMs - b.totalTimeMs);
  } else {
    podium.sort((a, b) => a.totalAttempts - b.totalAttempts || a.totalTimeMs - b.totalTimeMs);
  }
  room.podium = podium;
}

function pushHistory(player) {
  if (!player.attempts || player.attempts.length === 0) return;
  const last = player.history[player.history.length - 1];
  if (last && last.wordIndex === player.wordIndex) return;
  player.history.push({
    wordIndex: player.wordIndex,
    length: player.currentLength,
    attempts: player.attempts
  });
}

function recordSyncHistory(room) {
  room.players.forEach((player) => {
    pushHistory(player);
  });
}

const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));
app.get(
  [
    "/",
    "/multiplayer",
    "/multiplayer/",
    "/create",
    "/create/",
    "/join",
    "/join/",
    "/join/:code",
    "/join/:code/"
  ],
  (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
);

io.on("connection", (socket) => {
  /**
   * Remove a socket from its current room and clean up.
   */
  function removeFromRooms() {
    for (const room of rooms.values()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        socket.leave(room.code);
        if (room.hostId === socket.id && room.players.size > 0) {
          room.hostId = Array.from(room.players.keys())[0];
        }
        if (room.players.size === 0) {
          rooms.delete(room.code);
        } else {
          emitRoomState(room);
          checkAdvance(room);
        }
        break;
      }
    }
  }

  socket.on("leave_room", () => {
    removeFromRooms();
  });

  socket.on("create_room", (payload) => {
    removeFromRooms();
    const wordCount = Math.max(1, Math.min(20, Number(payload?.wordCount) || 1));
    const mode = payload?.mode === "timed" ? "timed" : "sync";
    const language = payload?.language === "en" ? "en" : "fr";
    const lengthMode = payload?.lengthMode === "range" ? "range" : "fixed";
    const fixedLength = Math.max(4, Math.min(10, Number(payload?.fixedLength) || 5));
    const minLength = Math.max(4, Math.min(10, Number(payload?.minLength) || 4));
    const maxLength = Math.max(minLength, Math.min(10, Number(payload?.maxLength) || minLength));

    let code = generateCode();
    while (rooms.has(code)) {
      code = generateCode();
    }

    const initialLength = lengthMode === "fixed" ? fixedLength : minLength;
    const room = {
      code,
      settings: {
        wordCount,
        mode,
        language,
        lengthMode,
        fixedLength,
        minLength,
        maxLength
      },
      wordIndex: -1,
      currentLength: initialLength,
      targetWord: null,
      firstLetter: "",
      wordLengths: [],
      wordList: [],
      podium: [],
      players: new Map(),
      gameOver: false,
      started: false,
      hostId: socket.id,
      nextGuest: 1
    };

    rooms.set(code, room);

    socket.join(code);
    const player = {
      id: socket.id,
      name: assignGuestName(room),
      score: 0,
      attempts: [],
      currentGuess: "",
      status: "waiting",
      wordIndex: -1,
      currentLength: initialLength,
      firstLetter: "",
      targetWord: null,
      totalAttempts: 0,
      startTime: null,
      endTime: null,
      finished: false,
      defeated: false,
      history: []
    };
    room.players.set(socket.id, player);

    emitRoomState(room);
  });

  socket.on("join_room", (payload) => {
    removeFromRooms();
    const code = normalizeCode(payload?.code);
    const room = rooms.get(code);
    if (!room) {
      socket.emit("error_msg", { text: "Room not found." });
      return;
    }
    if (room.started) {
      socket.emit("error_msg", { text: "Game already started." });
      return;
    }

    socket.join(code);
    const player = {
      id: socket.id,
      name: assignGuestName(room),
      score: 0,
      attempts: [],
      currentGuess: "",
      status: "waiting",
      wordIndex: -1,
      currentLength: room.currentLength,
      firstLetter: "",
      targetWord: null,
      totalAttempts: 0,
      startTime: null,
      endTime: null,
      finished: false,
      defeated: false,
      history: []
    };
    room.players.set(socket.id, player);

    emitRoomState(room);
  });

  socket.on("set_name", (payload) => {
    const code = normalizeCode(payload?.code);
    const room = rooms.get(code);
    if (!room) return;
    if (room.started) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    const raw = String(payload?.name || "").trim();
    if (!raw) return;
    player.name = raw.slice(0, 20);
    emitRoomState(room);
  });

  socket.on("start_game", (payload) => {
    const code = normalizeCode(payload?.code);
    const room = rooms.get(code);
    if (!room || room.started) return;
    if (room.hostId !== socket.id) return;
    room.started = true;
    room.wordIndex = -1;
    room.gameOver = false;
    room.targetWord = null;
    room.podium = [];
    room.wordLengths = buildLengthSequence(room.settings, room.currentLength);
    room.wordList = buildWordList(room);
    console.log(`Room ${room.code} starting game with words: ${room.wordList.join(", ")}`);
    if (!room.wordList) {
      room.gameOver = true;
      emitRoomState(room);
      return;
    }

    if (room.settings.mode === "sync") {
      room.wordIndex = 0;
      room.currentLength = room.wordLengths[0];
      room.targetWord = room.wordList[0];
      room.firstLetter = room.targetWord ? room.targetWord[0] : "";
      const startTime = Date.now();
      room.players.forEach((player) => {
        player.attempts = [];
        player.status = "playing";
        player.wordIndex = room.wordIndex;
        player.currentLength = room.currentLength;
        player.firstLetter = room.firstLetter;
        player.targetWord = room.targetWord;
        player.totalAttempts = 0;
        player.startTime = startTime;
        player.endTime = null;
        player.finished = false;
        player.defeated = false;
        player.history = [];
      });
      emitRoomState(room);
      return;
    }

    room.players.forEach((player) => {
      player.wordIndex = 0;
      player.currentLength = room.wordLengths[0];
      player.targetWord = room.wordList[0];
      player.firstLetter = player.targetWord ? player.targetWord[0] : "";
      player.attempts = [];
      player.status = "playing";
      player.totalAttempts = 0;
      player.startTime = Date.now();
      player.endTime = null;
      player.finished = false;
      player.defeated = false;
      player.history = [];
    });
    emitRoomState(room);
  });

  socket.on("restart_room", (payload) => {
    const code = normalizeCode(payload?.code);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    room.started = false;
    room.gameOver = false;
    room.wordIndex = -1;
    room.currentLength = room.settings.lengthMode === "fixed"
      ? room.settings.fixedLength
      : room.settings.minLength;
    room.targetWord = null;
    room.firstLetter = "";
    room.wordLengths = [];
    room.wordList = [];
    room.podium = [];
    room.players.forEach((player) => {
      player.attempts = [];
      player.currentGuess = "";
      player.status = "waiting";
      player.wordIndex = -1;
      player.currentLength = room.currentLength;
      player.firstLetter = "";
      player.targetWord = null;
      player.totalAttempts = 0;
      player.startTime = null;
      player.endTime = null;
      player.finished = false;
      player.defeated = false;
      player.history = [];
    });
    emitRoomState(room);
  });

  socket.on("submit_guess", (payload) => {
    const code = normalizeCode(payload?.code);
    const room = rooms.get(code);
    if (!room || room.gameOver || !room.started) return;

    const player = room.players.get(socket.id);
    if (!player || player.status !== "playing") return;

    const guess = normalizeGuess(payload?.guess);
    const expectedLength =
      room.settings.mode === "timed" ? player.currentLength : room.currentLength;
    if (guess.length !== expectedLength) {
      socket.emit("error_msg", { text: `Word must be ${expectedLength} letters.` });
      return;
    }

    if (!isValidWord(guess, room.settings.language, expectedLength)) {
      socket.emit("invalid_guess", { text: "Ce mot n'est pas dans la liste !"});
      return;
    }

    const target = room.settings.mode === "timed" ? player.targetWord : room.targetWord;
    const result = computeResult(guess, target);
    player.attempts.push({ guess, result });
    player.currentGuess = "";
    socket.emit("word_result", { guess, result });
    player.totalAttempts += 1;

    if (guess === target) {
      player.score += 1;
      if (room.settings.mode === "timed") {
        advancePlayerWord(room, player);
      } else {
        pushHistory(player);
        player.status = "done";
        if (!player.endTime) {
          player.endTime = Date.now();
        }
      }
    } else if (player.attempts.length >= MAX_ATTEMPTS) {
      if (room.settings.mode === "timed") {
        pushHistory(player);
        player.status = "done";
        player.defeated = true;
        player.finished = true;
        player.endTime = Date.now();
      } else {
        pushHistory(player);
        player.status = "done";
        player.defeated = true;
        player.finished = true;
        if (!player.endTime) {
          player.endTime = Date.now();
        }
      }
    }

    emitRoomState(room);
    checkAdvance(room);

  });

  socket.on("disconnect", () => {
    removeFromRooms();
  });
});

server.listen(PORT, () => {
  console.log(`Tusmo server running on port ${PORT}`);
});
