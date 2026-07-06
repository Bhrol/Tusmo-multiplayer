import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

import type { Language } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const englishWords = require("an-array-of-english-words") as string[];
const frenchWordsPath = path.join(__dirname, "indexer", "old");
const frenchWords = fs.readFileSync(frenchWordsPath, "utf8").split(/\r?\n/);

interface WordIndex {
  byLength: Record<number, string[]>;
  setByLength: Record<number, Set<string>>;
}

/**
 * Normalize words for matching: strip accents/punctuation and lowercase.
 */
function normalizeWord(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Build fast lookup tables by word length (4-10).
 */
function buildWordIndex(list: string[]): WordIndex {
  const byLength: Record<number, string[]> = {};
  const setByLength: Record<number, Set<string>> = {};
  list.forEach((entry) => {
    const cleaned = normalizeWord(entry);
    if (cleaned.length < 4 || cleaned.length > 10) return;
    if (!byLength[cleaned.length]) {
      byLength[cleaned.length] = [];
      setByLength[cleaned.length] = new Set();
    }
    if (!setByLength[cleaned.length].has(cleaned)) {
      byLength[cleaned.length].push(cleaned);
      setByLength[cleaned.length].add(cleaned);
    }
  });
  return { byLength, setByLength };
}

const wordsByLang: Record<Language, WordIndex> = {
  fr: buildWordIndex(frenchWords),
  en: buildWordIndex(englishWords)
};

function randomFrom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Pick a random word from the selected language and length.
 */
export function pickWord(length: number, language: Language): string | null {
  const list = wordsByLang[language]?.byLength[length];
  if (!list || list.length === 0) {
    return null;
  }
  return randomFrom(list).toUpperCase();
}

/**
 * Normalize a user's guess to the same format as the dictionary.
 */
export function normalizeGuess(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Z]/g, "");
}

/**
 * Check if a guess exists in the dictionary for a given language/length.
 */
export function isValidWord(guess: string, language: Language, length: number): boolean {
  return wordsByLang[language]?.setByLength[length]?.has(guess.toLowerCase()) ?? false;
}
