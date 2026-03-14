/**
 * Build the public color grid for a player (no letters).
 * @param {object} player
 * @param {number} length
 * @param {number} maxAttempts
 * @returns {number[][]}
 */
function buildGridForPlayer(player, length, maxAttempts) {
  const grid = [];
  for (let i = 0; i < maxAttempts; i += 1) {
    if (player.attempts[i]) {
      grid.push(player.attempts[i].result);
    } else {
      grid.push(Array(length).fill(3));
    }
  }
  return grid;
}

/**
 * Shape the payload sent to each client (private + public data).
 * @param {object} room
 * @param {string} socketId
 * @param {number} maxAttempts
 * @returns {object}
 */
export function buildRoomState(room, socketId, maxAttempts) {
  const players = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    status: p.status
  }));

  const you = room.players.get(socketId);
  const othersGrids = Array.from(room.players.values())
    .filter((p) => p.id !== socketId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      grid: buildGridForPlayer(p, room.currentLength, maxAttempts),
      status: p.status
    }));

  return {
    room: {
      code: room.code,
      wordIndex: Math.min(room.wordIndex + 1, room.settings.wordCount),
      wordCount: room.settings.wordCount,
      currentLength: room.currentLength,
      maxAttempts,
      gameOver: room.gameOver,
      started: room.started,
      hostId: room.hostId,
      firstLetter: room.firstLetter || "",
      language: room.settings.language,
      lengthMode: room.settings.lengthMode,
      fixedLength: room.settings.fixedLength,
      minLength: room.settings.minLength,
      maxLength: room.settings.maxLength
    },
    you: you
      ? {
          id: you.id,
          name: you.name,
          score: you.score,
          attempts: you.attempts,
          currentGuess: you.currentGuess,
          status: you.status
        }
      : null,
    players,
    othersGrids
  };
}
