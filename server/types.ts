/**
 * Shared in-memory game state.
 *
 * The server never persists rooms; these types document the live objects passed
 * between socket handlers, room progression helpers, and room-state projection.
 */
export type Language = "fr" | "en";
export type GameMode = "sync" | "timed";
export type LengthMode = "fixed" | "range";
export type PlayerStatus = "waiting" | "playing" | "done";
export type TileResult = 0 | 1 | 2;

export interface Attempt {
  guess: string;
  result: TileResult[];
}

export interface HistoryEntry {
  wordIndex: number;
  length: number;
  attempts: Attempt[];
}

export interface Player {
  id: string;
  name: string;
  score: number;
  attempts: Attempt[];
  currentGuess: string;
  status: PlayerStatus;
  wordIndex: number;
  currentLength: number;
  firstLetter: string;
  targetWord: string | null;
  totalAttempts: number;
  startTime: number | null;
  endTime: number | null;
  finished: boolean;
  defeated: boolean;
  history: HistoryEntry[];
}

export interface RoomSettings {
  wordCount: number;
  mode: GameMode;
  language: Language;
  lengthMode: LengthMode;
  fixedLength: number;
  minLength: number;
  maxLength: number;
}

export interface PodiumEntry {
  name: string;
  totalAttempts: number;
  totalTimeMs: number;
}

export interface Room {
  code: string;
  settings: RoomSettings;
  wordIndex: number;
  currentLength: number;
  targetWord: string | null;
  firstLetter: string;
  wordLengths: number[];
  wordList: string[];
  podium: PodiumEntry[];
  players: Map<string, Player>;
  gameOver: boolean;
  started: boolean;
  hostId: string;
  nextGuest: number;
  spectators: Set<string>;
}

export type PickWord = (length: number, language: Language) => string | null;
