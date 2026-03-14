import { dom } from "./dom.js";
import { appState } from "./state.js";
import { socket } from "./socket.js";
import { initGuess, handleKeyInput, setupKeyboardEvents } from "./input.js";
import { initRouter, goTo, renderRoute } from "./router.js";
import { setKeyHandler, showMessage, updateLengthMode, updateUI } from "./ui.js";

/**
 * Wire the input handler for the on-screen keyboard.
 */
setKeyHandler(handleKeyInput);

dom.lengthModeInput.addEventListener("change", updateLengthMode);
updateLengthMode();

dom.createBtn.addEventListener("click", () => {
  socket.emit("create_room", {
    name: "Player",
    language: dom.languageInput.value,
    wordCount: Number(dom.wordCountInput.value),
    lengthMode: dom.lengthModeInput.value,
    fixedLength: Number(dom.fixedLengthInput.value),
    minLength: Number(dom.minLengthInput.value),
    maxLength: Number(dom.maxLengthInput.value)
  });
});

dom.joinBtn.addEventListener("click", () => {
  socket.emit("join_room", {
    name: "Player",
    code: dom.codeInput.value.trim().toUpperCase()
  });
});

dom.homeBtn.addEventListener("click", () => {
  if (appState.state?.room) {
    socket.emit("leave_room");
    appState.state = null;
    appState.roomCode = null;
  }
  goTo("/");
  showMessage("");
});

dom.nameSave.addEventListener("click", () => {
  if (!appState.roomCode) return;
  const newName = dom.nameEdit.value.trim();
  socket.emit("set_name", { code: appState.roomCode, name: newName });
});

dom.waitingNameSave.addEventListener("click", () => {
  if (!appState.roomCode) return;
  const newName = dom.waitingNameInput.value.trim();
  socket.emit("set_name", { code: appState.roomCode, name: newName });
});

dom.waitingStartBtn.addEventListener("click", () => {
  if (!appState.roomCode) return;
  socket.emit("start_game", { code: appState.roomCode });
});

dom.startBtn.addEventListener("click", () => {
  if (!appState.roomCode) return;
  socket.emit("start_game", { code: appState.roomCode });
});

dom.modeMultiplayer.addEventListener("click", () => {
  goTo("/multiplayer");
});

dom.backToWelcome.addEventListener("click", () => {
  goTo("/");
});

dom.showCreate.addEventListener("click", () => {
  goTo("/create");
});

dom.showJoin.addEventListener("click", () => {
  goTo("/join");
});

/**
 * Sync client state from the server.
 * @param {object} payload
 */
socket.on("room_state", (payload) => {
  appState.state = payload;
  appState.roomCode = payload.room.code;
  const attemptCount = appState.state.you?.attempts?.length ?? 0;
  if (
    payload.room.wordIndex !== appState.lastWordIndex ||
    payload.room.currentLength !== appState.lastLength ||
    attemptCount !== appState.lastAttemptCount
  ) {
    initGuess();
  }
  appState.lastWordIndex = payload.room.wordIndex;
  appState.lastLength = payload.room.currentLength;
  appState.lastAttemptCount = attemptCount;
  renderRoute(location.pathname);
  updateUI();
});

socket.on("error_msg", (payload) => {
  showMessage(payload.text);
});

socket.on("room_message", (payload) => {
  showMessage(payload.text);
});

setupKeyboardEvents();
initRouter();
