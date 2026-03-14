import { dom } from "./dom.js";
import { appState } from "./state.js";
import { bounceVisibleButtons } from "./ui.js";
import { socket } from "./socket.js";

/**
 * Normalize route paths (trim trailing slashes).
 * @param {string} pathname
 * @returns {string}
 */
function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

/**
 * Route-aware UI switching for welcome/lobby/game.
 * @param {string} pathname
 */
export function renderRoute(pathname) {
  const path = normalizePath(pathname || "/");
  const joinMatch = path.match(/^\/join\/([A-Z0-9]{4})$/i);

  if (appState.state?.room && !appState.state.room.started) {
    dom.welcome.classList.add("hidden");
    dom.lobby.classList.remove("hidden");
    dom.appShell.classList.add("hidden");
    dom.createPanel.classList.add("hidden");
    dom.joinPanel.classList.add("hidden");
    dom.waitingPanel.classList.remove("hidden");
    dom.showCreate.classList.add("hidden");
    dom.showJoin.classList.add("hidden");
    bounceVisibleButtons();
    return;
  }

  if (appState.state?.room) {
    dom.welcome.classList.add("hidden");
    dom.lobby.classList.add("hidden");
    dom.appShell.classList.remove("hidden");
    dom.waitingPanel.classList.add("hidden");
    bounceVisibleButtons();
    return;
  }

  if (path === "/multiplayer") {
    dom.welcome.classList.add("hidden");
    dom.lobby.classList.remove("hidden");
    dom.appShell.classList.add("hidden");
    dom.createPanel.classList.add("hidden");
    dom.joinPanel.classList.add("hidden");
    dom.waitingPanel.classList.add("hidden");
    dom.showCreate.classList.remove("hidden");
    dom.showJoin.classList.remove("hidden");
    bounceVisibleButtons();
    return;
  }

  if (path === "/create") {
    dom.welcome.classList.add("hidden");
    dom.lobby.classList.remove("hidden");
    dom.appShell.classList.add("hidden");
    dom.createPanel.classList.remove("hidden");
    dom.joinPanel.classList.add("hidden");
    dom.waitingPanel.classList.add("hidden");
    dom.showCreate.classList.add("hidden");
    dom.showJoin.classList.add("hidden");
    bounceVisibleButtons();
    return;
  }

  if (path === "/join") {
    dom.welcome.classList.add("hidden");
    dom.lobby.classList.remove("hidden");
    dom.appShell.classList.add("hidden");
    dom.joinPanel.classList.remove("hidden");
    dom.createPanel.classList.add("hidden");
    dom.waitingPanel.classList.add("hidden");
    dom.showCreate.classList.add("hidden");
    dom.showJoin.classList.add("hidden");
    bounceVisibleButtons();
    return;
  }

  if (joinMatch) {
    dom.welcome.classList.add("hidden");
    dom.lobby.classList.remove("hidden");
    dom.appShell.classList.add("hidden");
    dom.joinPanel.classList.remove("hidden");
    dom.createPanel.classList.add("hidden");
    dom.waitingPanel.classList.add("hidden");
    dom.showCreate.classList.add("hidden");
    dom.showJoin.classList.add("hidden");
    dom.codeInput.value = joinMatch[1].toUpperCase();
    if (!appState.state?.room && appState.lastAutoJoinCode !== dom.codeInput.value) {
      appState.lastAutoJoinCode = dom.codeInput.value;
      socket.emit("join_room", { name: "Player", code: dom.codeInput.value });
    }
    bounceVisibleButtons();
    return;
  }

  dom.welcome.classList.remove("hidden");
  dom.lobby.classList.add("hidden");
  dom.appShell.classList.add("hidden");
  dom.waitingPanel.classList.add("hidden");
  bounceVisibleButtons();
}

/**
 * Client-side navigation helper.
 * @param {string} path
 */
export function goTo(path) {
  history.pushState(null, "", path);
  renderRoute(path);
}

/**
 * Initialize router and back/forward handling.
 */
export function initRouter() {
  renderRoute(location.pathname);
  window.addEventListener("popstate", () => {
    renderRoute(location.pathname);
  });
}
