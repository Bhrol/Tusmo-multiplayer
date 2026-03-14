# Tusmo Multiplayer

A Wordle-style multiplayer game with rooms, adjustable word lengths, and a Tusmo-inspired UI.

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Docker (Raspberry Pi compatible)

```bash
docker build -t tusmo-mp .
docker run -p 3000:3000 tusmo-mp
```

The `node:18-alpine` base image is multi-arch and runs on Raspberry Pi.

## Notes

- Use the lobby to create or join a room.
- You can change your username from the top bar once in a room.
- Other players grids show colors only, no letters.
