/**
 * Client-only state layered on top of the latest server `room_state` payload.
 *
 * The server remains authoritative for rooms, attempts, scores, and status.
 * `currentGuess`/`overrideMask` are local input buffers, while
 * `selectedPlayerId`/`reviewMode` control read-only review and spectator views.
 */
export const appState = {
  state: null,
  roomCode: null,
  currentGuess: [],
  overrideMask: [],
  lastWordIndex: null,
  lastLength: null,
  lastAttemptCount: null,
  lastAutoJoinCode: null,
  lastLetterIndex: null,
  selectedPlayerId: null,
  reviewMode: false
};
