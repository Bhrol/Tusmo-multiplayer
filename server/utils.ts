import type { Room } from "./types.js";

/**
 * Standardize room codes.
 */
export function normalizeCode(code: unknown): string {
  return String(code || "").trim().toUpperCase();
}

/**
 * Generate a short room code excluding ambiguous letters.
 */
export function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Assign sequential Guest names as players join.
 */
export function assignGuestName(room: Room): string {
  const name = `Guest${room.nextGuest}`;
  room.nextGuest += 1;
  return name;
}
