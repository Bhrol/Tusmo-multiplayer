import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const englishWords = require("an-array-of-english-words");
const frenchWordsPath = path.join(__dirname, "indexer", "old");
const frenchWords = fs.readFileSync(frenchWordsPath, "utf8").split(/\r?\n/);

/**
 * Normalize words for matching: strip accents/punctuation and lowercase.
 * @param {string} value
 * @returns {string}
 */
function normalizeWord(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Build fast lookup tables by word length (4-10).
 * @param {string[]} list
 */
function buildWordIndex(list) {
  const byLength = {};
  const setByLength = {};
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

const wordsByLang = {
  fr: buildWordIndex(frenchWords),
  en: buildWordIndex(englishWords)
};

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Pick a random word from the selected language and length.
 * @param {number} length
 * @param {"fr"|"en"} language
 * @returns {string|null}
 */
export function pickWord(length, language) {
  const list = wordsByLang?.[language]?.byLength?.[length];
  if (!list || list.length === 0) {
    return null;
  }
  return randomFrom(list).toUpperCase();
}

/**
 * Normalize a user's guess to the same format as the dictionary.
 * @param {string} value
 * @returns {string}
 */
export function normalizeGuess(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Z]/g, "");
}

/**
 * Check if a guess exists in the dictionary for a given language/length.
 * @param {string} guess
 * @param {"fr"|"en"} language
 * @param {number} length
 * @returns {boolean}
 */
export function isValidWord(guess, language, length) {
  const wordSet = wordsByLang?.[language]?.setByLength?.[length] || new Set();
  return wordSet.has(guess.toLowerCase());
}
