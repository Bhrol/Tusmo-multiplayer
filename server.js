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
  const allDone = Array.from(room.players.values()).every((p) => p.status === "done");
  if (allDone) {
    startNewWord(room, pickWord);
    emitRoomState(room);
    io.to(room.code).emit("room_message", {
      text: room.gameOver
        ? "Game over!"
        : `Next word ${room.wordIndex + 1}/${room.settings.wordCount}`
    });
  }
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
      status: "waiting"
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
      status: "waiting"
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
    startNewWord(room, pickWord);
    emitRoomState(room);
  });

  socket.on("submit_guess", (payload) => {
    const code = normalizeCode(payload?.code);
    const room = rooms.get(code);
    if (!room || room.gameOver || !room.started) return;

    const player = room.players.get(socket.id);
    if (!player || player.status !== "playing") return;

    const guess = normalizeGuess(payload?.guess);
    if (guess.length !== room.currentLength) {
      socket.emit("error_msg", { text: `Word must be ${room.currentLength} letters.`} );
      return;
    }

    if (!isValidWord(guess, room.settings.language, room.currentLength)) {
      socket.emit("invalid_guess", { text: "Ce mot n'est pas dans la liste !"});
      return;
    }

    const result = computeResult(guess, room.targetWord);
    player.attempts.push({ guess, result });
    player.currentGuess = "";
    socket.emit("word_result", { guess, result });

    if (guess === room.targetWord) {
      player.score += 1;
      player.status = "done";
    } else if (player.attempts.length >= MAX_ATTEMPTS) {
      player.status = "done";
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
