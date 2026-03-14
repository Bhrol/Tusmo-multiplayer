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
    const idx = appState.lastLetterIndex ? appState.lastLetterIndex : 1;
    if (idx >= 0) {
      appState.lastLetterIndex = idx-1;
      appState.currentGuess[idx] = "";
      appState.overrideMask[idx] = true;
    }
    buildGrid();
    return;
  }

  if (/^[A-Z]$/.test(key)) {
    const idx = (appState.lastLetterIndex ? appState.lastLetterIndex : 0) +1;
    if (idx >= 0 && idx < length) {
      appState.lastLetterIndex = idx;
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
