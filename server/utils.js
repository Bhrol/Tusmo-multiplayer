/**
 * Standardize room codes.
 * @param {string} code
 * @returns {string}
 */
export function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * Generate a short room code excluding ambiguous letters.
 * @returns {string}
 */
export function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Assign sequential Guest names as players join.
 * @param {object} room
 * @returns {string}
 */
export function assignGuestName(room) {
  const name = `Guest${room.nextGuest}`;
  room.nextGuest += 1;
  return name;
}
