import nspell from 'nspell';

let _spellchecker = null;
let _initPromise = null;

async function getSpellchecker() {
  if (_spellchecker) return _spellchecker;
  if (_initPromise) return _initPromise;

  _initPromise = Promise.all([
    fetch('./dictionary-en-gb/index.aff').then((r) => r.text()),
    fetch('./dictionary-en-gb/index.dic').then((r) => r.text()),
  ]).then(([aff, dic]) => {
    _spellchecker = nspell(aff, dic);
    return _spellchecker;
  }).catch((err) => {
    _initPromise = null;
    throw err;
  });

  return _initPromise;
}

function normalizeWikiMarkup(text) {
  return text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_match, target, _separator, display) => {
    return (display || target || '').trim();
  });
}

function extractWords(text) {
  const source = normalizeWikiMarkup(text || '');
  const matches = source.match(/[A-Za-z][A-Za-z'-]*/g);
  return matches || [];
}

function stripPossessive(word) {
  const possessiveSuffixes = ["'s", '\u2019s'];
  for (const suffix of possessiveSuffixes) {
    if (word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  const trailingApostrophes = ["'", '\u2019'];
  for (const apostrophe of trailingApostrophes) {
    if (word.endsWith(apostrophe)) {
      return word.slice(0, -apostrophe.length);
    }
  }
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceMisspelledWord(text, originalWord, replacementWord) {
  if (!text || !originalWord || !replacementWord) {
    return text || '';
  }

  const pattern = new RegExp(`\\b${escapeRegExp(originalWord)}\\b`, 'g');
  return text.replace(pattern, replacementWord);
}

export async function findSpellingIssues(text, customWords = [], options = {}) {
  const checker = await getSpellchecker();
  const customWordSet = new Set(customWords.map((word) => word.toLowerCase()));
  const misspelled = new Map();
  const rawMaxSuggestions = Number.isInteger(options.maxSuggestions)
    ? options.maxSuggestions
    : 3;
  const maxSuggestions = Math.min(Math.max(rawMaxSuggestions, 0), 50);

  for (const word of extractWords(text)) {
    const normalizedWord = word.toLowerCase();
    if (customWordSet.has(normalizedWord)) {
      continue;
    }

    const baseWord = stripPossessive(normalizedWord);
    if (baseWord && customWordSet.has(baseWord)) {
      continue;
    }

    if (!checker.correct(word) && !misspelled.has(word)) {
      const suggestions = checker
        .suggest(word)
        .filter(Boolean)
        .filter((suggestion) => suggestion.toLowerCase() !== normalizedWord)
        .slice(0, maxSuggestions);

      misspelled.set(word, {
        word,
        suggestions,
      });
    }
  }

  return Array.from(misspelled.values()).sort((left, right) => left.word.localeCompare(right.word));
}

export async function findMisspelledWords(text, customWords = []) {
  const issues = await findSpellingIssues(text, customWords);
  return issues.map((issue) => issue.word);
}