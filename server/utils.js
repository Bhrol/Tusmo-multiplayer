export function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function assignGuestName(room) {
  const name = `Guest${room.nextGuest}`;
  room.nextGuest += 1;
  return name;
}
