import { appState } from "./state.js";
import { buildGrid, getFixedLetters, showMessage } from "./ui.js";
import { socket } from "./socket.js";

/**
 * Initialize the guess buffer with fixed letters.
 */
export function initGuess() {
  const length = appState.state?.room?.currentLength || 0;
  const fixed = getFixedLetters();
  appState.currentGuess = Array.from({ length }, (_, i) => fixed[i] || "");
  appState.overrideMask = Array.from({ length }, () => false);
}

/**
 * Find the next empty slot for typing.
 * @returns {number}
 */
function findNextIndex() {
  for (let i = 0; i < appState.currentGuess.length; i += 1) {
    if (!appState.currentGuess[i]) return i;
  }
  return -1;
}

/**
 * Find the previous filled slot for backspace (skip fixed first letter).
 * @returns {number}
 */
function findPrevIndex() {
  for (let i = appState.currentGuess.length - 1; i >= 0; i -= 1) {
    if (i === 0 && appState.state?.room?.firstLetter) {
      continue;
    }
    if (appState.currentGuess[i]) {
      return i;
    }
  }
  return -1;
}

/**
 * Handle both on-screen and physical keyboard input.
 * @param {string} key
 */
export function handleKeyInput(key) {
  if (!appState.state?.room || !appState.state?.you) return;
  if (!appState.state.room.started || appState.state.room.gameOver) return;
  if (appState.state.you.status !== "playing") return;
  const length = appState.state.room.currentLength;

  if (key === "ENTER") {
    const fixed = getFixedLetters();
    const composed = appState.currentGuess.map((ch, idx) =>
      ch || (appState.overrideMask[idx] ? "" : fixed[idx]) || ""
    );
    if (composed.some((ch) => !ch)) {
      showMessage(`Word must be ${length} letters.`);
      return;
    }
    socket.emit("submit_guess", { code: appState.roomCode, guess: composed.join("") });
    return;
  }

  if (key === "BACK") {
    const idx = findNextIndex() - 1; // Backspace should remove the last filled character
    if (idx >= 0) {
      appState.currentGuess[idx] = "";
      appState.overrideMask[idx] = true;
    }
    buildGrid();
    return;
  }

  if (/^[A-Z]$/.test(key)) {
    const idx = findNextIndex();
    if (idx >= 0 && idx < length) {
      appState.currentGuess[idx] = key;
      appState.overrideMask[idx] = true;
    }
    buildGrid();
  }
}

/**
 * Bind physical keyboard events once.
 */
export function setupKeyboardEvents() {
  document.addEventListener("keydown", (event) => {
    if (!appState.state?.room) return;
    const key = event.key.toUpperCase();
    if (key === "BACKSPACE") return handleKeyInput("BACK");
    if (key === "ENTER") return handleKeyInput("ENTER");
    if (/^[A-Z]$/.test(key)) return handleKeyInput(key);
  });
}
