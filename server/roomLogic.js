/**
 * Resolve the next word length based on room settings.
 * @param {object} room
 * @returns {number}
 */
export function nextLength(room) {
  if (room.settings.lengthMode === "fixed") {
    return room.settings.fixedLength;
  }
  const next = room.currentLength + 1;
  return next > room.settings.maxLength ? room.settings.minLength : next;
}

/**
 * Advance to the next word and reset player attempts.
 * @param {object} room
 * @param {(length: number, language: string) => string|null} pickWord
 */
export function startNewWord(room, pickWord) {
  room.wordIndex += 1;
  if (room.wordIndex >= room.settings.wordCount) {
    room.gameOver = true;
    room.players.forEach((player) => {
      player.status = "done";
    });
    return;
  }

  room.currentLength = room.wordIndex === 0 ? room.currentLength : nextLength(room);
  room.targetWord = pickWord(room.currentLength, room.settings.language);
  room.firstLetter = room.targetWord ? room.targetWord[0] : "";
  if (!room.targetWord) {
    room.gameOver = true;
    return;
  }

  room.players.forEach((player) => {
    if (player.defeated) {
      player.status = "done";
      return;
    }
    player.attempts = [];
    player.currentGuess = "";
    player.status = "playing";
    player.wordIndex = room.wordIndex;
    player.currentLength = room.currentLength;
    player.firstLetter = room.firstLetter;
    player.targetWord = room.targetWord;
  });
}
