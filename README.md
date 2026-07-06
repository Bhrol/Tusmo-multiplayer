# Tusmo Multiplayer

A Wordle-style multiplayer game with rooms, adjustable word lengths, and a Tusmo-inspired UI.

## Run locally

```bash
npm install
npm run build
npm start
```

Then open `http://localhost:3141`.

For development with automatic TypeScript compilation and browser refresh:

```bash
npm run dev
```

## Project structure

- `server.ts` owns the Socket.IO event handlers, room lifecycle, scoring, and game progression.
- `server/types.ts` documents the in-memory room/player model shared by the server helpers.
- `server/wordStore.ts` loads and normalizes the French and English dictionaries into lookup tables by word length.
- `server/roomState.ts` builds per-socket payloads. The current player receives their letters; other players are masked until spectator/review mode.
- `public/*.ts` is the browser client. The emitted `*.js` files are served directly by Express, so run `npm run build` after TypeScript changes before `npm start`.

## Game modes

- `Less Attempts` (`sync`) makes all active players solve the same word before the room advances.
- `Timed (No Wait)` (`timed`) gives each player the preselected word sequence independently and ranks by finish time.

## Docker (Raspberry Pi compatible)

```bash
docker build -t tusmo-mp .
docker run -p 3141:3141 tusmo-mp
```

The `node:18-alpine` base image is multi-arch and runs on Raspberry Pi.

## Notes

- Use the lobby to create or join a room.
- You can change your username from the top bar once in a room.
- Other players grids show colors only, no letters.
