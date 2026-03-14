import { dom } from "./dom.js";
import { appState } from "./state.js";

const KEYBOARD_LAYOUT = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["BACK", "W", "X", "C", "V", "B", "N", "ENTER"]
];

let keyHandler = null;
let prevRowLetters = [];
let prevRowIndex = -1;

/**
 * Inject keyboard handler to avoid circular imports.
 * @param {(key: string) => void} handler
 */
export function setKeyHandler(handler) {
  keyHandler = handler;
}

/**
 * Apply bounce animation to visible buttons when routes change.
 */
export function bounceVisibleButtons() {
  const buttons = Array.from(document.querySelectorAll("button")).filter(
    (btn) => btn.offsetParent !== null
  );
  buttons.forEach((btn) => {
    btn.classList.remove("bounce-in");
    void btn.offsetWidth;
    btn.classList.add("bounce-in");
  });
}

/**
 * Update the status message area.
 * @param {string} text
 */
export function showMessage(text) {
  dom.message.textContent = text || "";
}

/**
 * Toggle fixed vs range length inputs.
 */
export function updateLengthMode() {
  const mode = dom.lengthModeInput.value;
  if (mode === "fixed") {
    dom.fixedLengthWrap.classList.remove("hidden");
    dom.rangeWrap.classList.add("hidden");
  } else {
    dom.fixedLengthWrap.classList.add("hidden");
    dom.rangeWrap.classList.remove("hidden");
  }
}

/**
 * Render the on-screen keyboard with status coloring.
 * @param {Record<string, number>} keyState
 */
export function buildKeyboard(keyState) {
  dom.keyboard.innerHTML = "";
  KEYBOARD_LAYOUT.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    row.forEach((key) => {
      const btn = document.createElement("button");
      btn.className = "key";
      if (key === "BACK" || key === "ENTER") {
        btn.classList.add("wide");
      }
      btn.textContent = key === "BACK" ? "⌫" : key === "ENTER" ? "⏎" : key;
      const status = keyState[key];
      if (status === 2) btn.classList.add("correct");
      if (status === 1) btn.classList.add("present");
      if (status === 0) btn.classList.add("absent");
      btn.addEventListener("click", () => keyHandler?.(key));
      rowEl.appendChild(btn);
    });
    dom.keyboard.appendChild(rowEl);
  });
}

/**
 * Collect letters that must stay visible across attempts.
 * @returns {string[]}
 */
export function getFixedLetters() {
  const length = appState.state?.room?.currentLength || 0;
  const fixed = Array(length).fill("");
  if (appState.state?.room?.firstLetter) {
    fixed[0] = appState.state.room.firstLetter;
  }
  if (appState.state?.you?.attempts) {
    appState.state.you.attempts.forEach((attempt) => {
      attempt.result.forEach((status, idx) => {
        if (status === 2) {
          fixed[idx] = attempt.guess[idx];
        }
      });
    });
  }
  return fixed;
}

/**
 * Render the main guess grid.
 */
export function buildGrid() {
  if (!appState.state?.room || !appState.state?.you) return;
  const length = appState.state.room.currentLength;
  const fixedLetters = getFixedLetters();
  const activeRow = appState.state.you.attempts.length;
  if (activeRow !== prevRowIndex || prevRowLetters.length !== length) {
    prevRowIndex = activeRow;
    prevRowLetters = Array(length).fill(null);
  }
  dom.grid.style.gridTemplateRows = `repeat(${appState.state.room.maxAttempts}, 1fr)`;
  dom.grid.innerHTML = "";
  for (let row = 0; row < appState.state.room.maxAttempts; row += 1) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.style.gridTemplateColumns = `repeat(${length}, 1fr)`;
    for (let col = 0; col < length; col += 1) {
      const cell = document.createElement("div");
      cell.className = "tile-cell empty";

      const attempt = appState.state.you.attempts[row];
      if (attempt) {
        const letter = attempt.guess[col];
        cell.textContent = letter;
        const status = attempt.result[col];
        cell.classList.remove("empty");
        if (status === 2) cell.classList.add("correct");
        if (status === 1) cell.classList.add("present");
        if (status === 0) cell.classList.add("absent");
      } else if (row === activeRow) {
        const letter =
          appState.currentGuess[col] ||
          (appState.overrideMask[col] ? "" : fixedLetters[col]) ||
          "";
        cell.textContent = letter || "·";
        if (letter) {
          cell.classList.add("current-fill");
        } else {
          cell.classList.add("current-dot");
        }
        if (prevRowLetters[col] !== null && prevRowLetters[col] !== letter) {
          cell.classList.add("cell-bounce");
        }
        prevRowLetters[col] = letter;
      }
      rowEl.appendChild(cell);
    }
    dom.grid.appendChild(rowEl);
  }
}

/**
 * Aggregate letter statuses for keyboard coloring.
 * @returns {Record<string, number>}
 */
export function buildKeyState() {
  const keyState = {};
  if (!appState.state?.you) return keyState;
  appState.state.you.attempts.forEach((attempt) => {
    attempt.guess.split("").forEach((letter, idx) => {
      const status = attempt.result[idx];
      const current = keyState[letter];
      if (current === undefined || status > current) {
        keyState[letter] = status;
      }
    });
  });
  return keyState;
}

/**
 * Render other players' masked grids.
 */
export function buildPlayers() {
  dom.playersList.innerHTML = "";
  if (!appState.state?.othersGrids) return;

  appState.state.othersGrids.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card";

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = `${player.name} ${player.status === "done" ? "✓" : ""}`;

    const gridEl = document.createElement("div");
    gridEl.className = "player-grid";
    gridEl.style.gridTemplateRows = `repeat(${appState.state.room.maxAttempts}, 1fr)`;

    player.grid.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "player-row";
      rowEl.style.gridTemplateColumns = `repeat(${row.length}, 1fr)`;
      row.forEach((status) => {
        const cell = document.createElement("div");
        cell.className = "player-cell";
        if (status === 2) cell.classList.add("correct");
        if (status === 1) cell.classList.add("present");
        if (status === 0) cell.classList.add("absent");
        rowEl.appendChild(cell);
      });
      gridEl.appendChild(rowEl);
    });

    card.appendChild(name);
    card.appendChild(gridEl);
    dom.playersList.appendChild(card);
  });
}

/**
 * Update header stats (word, score, room).
 */
export function updateStats() {
  if (!appState.state?.room || !appState.state?.you) return;
  if (!appState.state.room.started) {
    dom.wordStat.textContent = "Waiting";
  } else {
    dom.wordStat.textContent = `Mot ${appState.state.room.wordIndex}/${appState.state.room.wordCount}`;
  }
  dom.scoreStat.textContent = `Score ${appState.state.you.score}`;
  dom.roomPill.textContent = `Room ${appState.state.room.code}`;
}

/**
 * Render waiting room settings and player list.
 */
export function renderWaitingRoom() {
  if (!appState.state?.room) return;
  const modeLabel =
    appState.state.room.lengthMode === "fixed"
      ? `Fixed length: ${appState.state.room.fixedLength}`
      : `Increasing length: ${appState.state.room.minLength} → ${appState.state.room.maxLength}`;
  const languageLabel = appState.state.room.language === "en" ? "English" : "French";
  dom.waitingSettings.innerHTML = `
    <div>Room: ${appState.state.room.code}</div>
    <div>Words: ${appState.state.room.wordCount}</div>
    <div>Language: ${languageLabel}</div>
    <div>${modeLabel}</div>
  `;

  if (appState.state.you) {
    dom.waitingNameInput.value = appState.state.you.name;
  }

  dom.waitingPlayers.innerHTML = "";
  appState.state.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "waiting-item";
    row.textContent = player.name;
    dom.waitingPlayers.appendChild(row);
  });

  const isHost = appState.state.room.hostId === appState.state.you.id;
  dom.waitingStartBtn.classList.toggle("hidden", !isHost);
}

/**
 * Main UI refresh after a state change.
 */
export function updateUI() {
  if (!appState.state) return;
  buildGrid();
  buildKeyboard(buildKeyState());
  buildPlayers();
  updateStats();
  if (appState.state.you && dom.nameEdit) {
    dom.nameEdit.value = appState.state.you.name;
  }
  if (!appState.state.room.started) {
    renderWaitingRoom();
  }
  const canEditName = !appState.state.room.started;
  dom.nameEdit.disabled = !canEditName;
  dom.nameSave.disabled = !canEditName;
  const isHost = appState.state.room.hostId === appState.state.you.id;
  dom.startBtn.classList.toggle("hidden", appState.state.room.started || !isHost);
  if (!appState.state.room.started) {
    showMessage(isHost ? "You can start the game." : "Waiting for host to start.");
  }
  if (appState.state.room.started && !appState.state.room.gameOver) {
    showMessage("");
  }
  if (appState.state.room.gameOver) {
    showMessage("Game over. Create a new room to play again.");
  }
}
