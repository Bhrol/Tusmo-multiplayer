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
    name.textContent = player.name;
    if (player.status === "playing") {
      const icon = document.createElement("span");
      icon.className = "player-status-icon";
      icon.textContent = "▶";
      name.appendChild(icon);
    } else if (player.status === "done") {
      const icon = document.createElement("span");
      icon.className = "player-status-icon";
      icon.textContent = "✓";
      name.appendChild(icon);
    }

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
 * Render the per-word attempt history for the current player.
 */
export function renderHistory() {
  if (!dom.historyList) return;
  dom.historyList.innerHTML = "";
  const history = appState.state?.you?.history || [];
  const maxAttempts = appState.state?.room?.maxAttempts || 0;
  if (!appState.state?.room?.started || history.length === 0) {
    dom.historyPanel?.classList.add("hidden");
    dom.main?.classList.add("history-hidden");
    return;
  }
  dom.historyPanel?.classList.remove("hidden");
  dom.main?.classList.remove("history-hidden");

  history.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "history-card";

    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = `Word ${entry.wordIndex + 1}`;

    const grid = document.createElement("div");
    grid.className = "history-grid";
    grid.style.gridTemplateRows = `repeat(${maxAttempts}, 1fr)`;

    for (let row = 0; row < maxAttempts; row += 1) {
      const rowEl = document.createElement("div");
      rowEl.className = "history-row";
      rowEl.style.gridTemplateColumns = `repeat(${entry.length}, 1fr)`;
      const attempt = entry.attempts[row];
      for (let col = 0; col < entry.length; col += 1) {
        const cell = document.createElement("div");
        cell.className = "history-cell";
        if (attempt) {
          const letter = attempt.guess[col];
          const status = attempt.result[col];
          cell.textContent = letter;
          if (status === 2) cell.classList.add("correct");
          if (status === 1) cell.classList.add("present");
          if (status === 0) cell.classList.add("absent");
        }
        rowEl.appendChild(cell);
      }
      grid.appendChild(rowEl);
    }

    card.appendChild(title);
    card.appendChild(grid);
    dom.historyList.appendChild(card);
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
  const modeName = appState.state.room.mode === "timed" ? "Timed (No Wait)" : "Less Attempts";
  const languageLabel = appState.state.room.language === "en" ? "English" : "French";
  dom.waitingSettings.innerHTML = `
    <div>Room: ${appState.state.room.code}</div>
    <div>Words: ${appState.state.room.wordCount}</div>
    <div>Language: ${languageLabel}</div>
    <div>Mode: ${modeName}</div>
    <div>${modeLabel}</div>
  `;

  if (dom.modeInput) {
    dom.modeInput.value = appState.state.room.mode === "timed" ? "timed" : "sync";
  }
  if (dom.languageInput) {
    dom.languageInput.value = appState.state.room.language === "en" ? "en" : "fr";
  }
  if (dom.wordCountInput) {
    dom.wordCountInput.value = String(appState.state.room.wordCount);
  }
  if (dom.lengthModeInput) {
    dom.lengthModeInput.value =
      appState.state.room.lengthMode === "range" ? "range" : "fixed";
  }
  if (dom.fixedLengthInput) {
    dom.fixedLengthInput.value = String(appState.state.room.fixedLength);
  }
  if (dom.minLengthInput) {
    dom.minLengthInput.value = String(appState.state.room.minLength);
  }
  if (dom.maxLengthInput) {
    dom.maxLengthInput.value = String(appState.state.room.maxLength);
  }
  updateLengthMode();

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
 * Format a duration in mm:ss.
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = String(totalSec % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Render the podium overlay when the game ends.
 */
export function renderPodium() {
  const players = appState.state?.players || [];
  if (!players.length) return;
  const finished = players.filter((p) => p.status === "done");
  const pending = players.filter((p) => p.status !== "done");
  const mode = appState.state.room.mode;

  const ranked = finished.filter((p) => !p.defeated).sort((a, b) => {
    if (mode === "timed") {
      const aTime = (a.endTime || 0) - (a.startTime || 0);
      const bTime = (b.endTime || 0) - (b.startTime || 0);
      return aTime - bTime;
    }
    const aAttempts = a.totalAttempts ?? 0;
    const bAttempts = b.totalAttempts ?? 0;
    const aTime = (a.endTime || 0) - (a.startTime || 0);
    const bTime = (b.endTime || 0) - (b.startTime || 0);
    return aAttempts - bAttempts || aTime - bTime;
  });

  dom.podiumTop.textContent = "";
  dom.podiumLeft.textContent = "";
  dom.podiumRight.textContent = "";
  dom.podiumRest.innerHTML = "";

  ranked.forEach((entry, idx) => {
    const row = document.createElement("div");
    row.className = "podium-item";
    const rank = idx + 1;
    const medal = document.createElement("span");
    medal.className = `podium-medal medal-${Math.min(rank, 3)}`;
    const detail =
      mode === "timed"
        ? `${formatTime((entry.endTime || 0) - (entry.startTime || 0))}`
        : `${entry.totalAttempts ?? 0} attempts`;
    row.appendChild(medal);
    row.appendChild(document.createTextNode(`${rank}. ${entry.name} — ${detail}`));
    if (rank === 1) {
      dom.podiumTop.appendChild(row);
      const rankTag = document.createElement("div");
      rankTag.className = "podium-rank";
      rankTag.textContent = "1";
      dom.podiumTop.prepend(rankTag);
    } else if (rank === 2) {
      dom.podiumLeft.appendChild(row);
      const rankTag = document.createElement("div");
      rankTag.className = "podium-rank";
      rankTag.textContent = "2";
      dom.podiumLeft.prepend(rankTag);
    } else if (rank === 3) {
      dom.podiumRight.appendChild(row);
      const rankTag = document.createElement("div");
      rankTag.className = "podium-rank";
      rankTag.textContent = "3";
      dom.podiumRight.prepend(rankTag);
    } else {
      dom.podiumRest.appendChild(row);
    }
  });

  finished
    .filter((p) => p.defeated)
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "podium-item";
      row.appendChild(document.createTextNode(`${entry.name} — defeated`));
      dom.podiumRest.appendChild(row);
    });

  pending.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "podium-item";
    const spinner = document.createElement("span");
    spinner.className = "podium-spinner";
    row.appendChild(spinner);
    row.appendChild(document.createTextNode(`${entry.name} — playing`));
    dom.podiumRest.appendChild(row);
  });

  dom.podiumOverlay.classList.remove("hidden");
}

/**
 * Main UI refresh after a state change.
 */
export function updateUI() {
  if (!appState.state) return;
  buildGrid();
  buildKeyboard(buildKeyState());
  buildPlayers();
  renderHistory();
  updateStats();
  if (appState.state.you && dom.nameEdit) {
    dom.nameEdit.value = appState.state.you.name;
  }
  if (!appState.state.room.started) {
    renderWaitingRoom();
    dom.appShell.classList.add("hidden");
    dom.lobby.classList.remove("hidden");
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
  const youDone = appState.state.you?.status === "done";
  if (youDone) {
    showMessage("Waiting for others to finish...");
    renderPodium();
  } else if (appState.state.room.gameOver) {
    showMessage("Game over. Create a new room to play again.");
    renderPodium();
  } else {
    dom.podiumOverlay.classList.add("hidden");
  }

  const shouldShowPodium = youDone || appState.state.room.gameOver;
  const shouldHideApp = !appState.state.room.started || shouldShowPodium;
  dom.appShell.classList.toggle("hidden", shouldHideApp);
  dom.lobby.classList.toggle(
    "hidden",
    appState.state.room.started || shouldShowPodium
  );
}
