import nspell from 'nspell';

let _spellchecker = null;
let _initPromise = null;

async function getSpellchecker() {
  if (_spellchecker) return _spellchecker;
  if (_initPromise) return _initPromise;

  _initPromise = Promise.all([
    fetch('./dictionary-en/index.aff').then((r) => r.text()),
    fetch('./dictionary-en/index.dic').then((r) => r.text()),
  ]).then(([aff, dic]) => {
    _spellchecker = nspell(aff, dic);
    return _spellchecker;
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

export async function findMisspelledWords(text, customWords = []) {
  const checker = await getSpellchecker();
  const customWordSet = new Set(customWords.map((word) => word.toLowerCase()));
  const misspelled = new Set();

  for (const word of extractWords(text)) {
    const normalizedWord = word.toLowerCase();
    if (customWordSet.has(normalizedWord)) {
      continue;
    }

    if (!checker.correct(word)) {
      misspelled.add(word);
    }
  }

  return Array.from(misspelled).sort((left, right) => left.localeCompare(right));
}