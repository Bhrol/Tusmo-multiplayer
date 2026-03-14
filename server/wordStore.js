import { createRequire } from "module";

const require = createRequire(import.meta.url);
const frenchWords = require("an-array-of-french-words");
const englishWords = require("an-array-of-english-words");

function normalizeWord(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/g, "");
}

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

export function pickWord(length, language) {
  const list = wordsByLang?.[language]?.byLength?.[length];
  if (!list || list.length === 0) {
    return null;
  }
  return randomFrom(list).toUpperCase();
}

export function normalizeGuess(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Z]/g, "");
}

export function isValidWord(guess, language, length) {
  const wordSet = wordsByLang?.[language]?.setByLength?.[length] || new Set();
  return wordSet.has(guess.toLowerCase());
}
