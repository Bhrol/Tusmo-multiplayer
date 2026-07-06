import type { PickWord, Room } from "./types.js";

/**
 * Resolve the next word length based on room settings.
 */
export function nextLength(room: Room): number {
  if (room.settings.lengthMode === "fixed") {
    return room.settings.fixedLength;
  }
  const next = room.currentLength + 1;
  return next > room.settings.maxLength ? room.settings.minLength : next;
}

/**
 * Advance a sync-mode room to its next preselected word.
 *
 * The room builds `wordLengths` and `wordList` before play starts so timed and
 * sync modes use the same sequence. The optional picker is only a fallback for
 * older room objects that do not have a prebuilt list.
 */
export function startNewWord(room: Room, pickWord?: PickWord): void {
  room.wordIndex += 1;
  if (room.wordIndex >= room.settings.wordCount) {
    room.gameOver = true;
    room.players.forEach((player) => {
      player.status = "done";
      player.finished = true;
      if (!player.endTime) {
        player.endTime = Date.now();
      }
    });
    return;
  }

  room.currentLength = room.wordLengths[room.wordIndex] ?? (
    room.wordIndex === 0 ? room.currentLength : nextLength(room)
  );
  room.targetWord =
    room.wordList[room.wordIndex] ?? pickWord?.(room.currentLength, room.settings.language) ?? null;
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
