import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const affContent = readFileSync(
  resolve(process.cwd(), 'node_modules/dictionary-en/index.aff'),
  'utf8'
);
const dicContent = readFileSync(
  resolve(process.cwd(), 'node_modules/dictionary-en/index.dic'),
  'utf8'
);

function makeFetchMock() {
  return vi.fn((url) => {
    const content = url.includes('.aff') ? affContent : dicContent;
    return Promise.resolve({ text: () => Promise.resolve(content) });
  });
}

describe('spellcheck helpers', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('suppresses wiki-derived dictionary words while keeping real misspellings', async () => {
    const { findMisspelledWords } = await import('../../../src/lib/spellcheck.js');
    const misspelled = await findMisspelledWords('Frodo Baggins meets Alise in the Shire.', ['Frodo', 'Baggins', 'Shire']);

    expect(misspelled).toContain('Alise');
    expect(misspelled).not.toContain('Frodo');
    expect(misspelled).not.toContain('Baggins');
    expect(misspelled).not.toContain('Shire');
  });

  it('extracts words from wiki markup and special-character titles', async () => {
    const { findMisspelledWords } = await import('../../../src/lib/spellcheck.js');
    const misspelled = await findMisspelledWords(
      "[[Bob's Tavern (The Inn)|The Inn]] welcomes Alise tonight.",
      ['Bob', 'Tavern', 'The', 'Inn']
    );

    expect(misspelled).toContain('Alise');
    expect(misspelled).not.toContain('Bob');
    expect(misspelled).not.toContain('Tavern');
    expect(misspelled).not.toContain('Inn');
  });

  it('deduplicates repeated misspellings', async () => {
    const { findMisspelledWords } = await import('../../../src/lib/spellcheck.js');
    const misspelled = await findMisspelledWords('Alise saw Alise again.', []);

    expect(misspelled).toEqual(['Alise']);
  });

  it('returns suggestions for misspelled words', async () => {
    const { findSpellingIssues } = await import('../../../src/lib/spellcheck.js');
    const issues = await findSpellingIssues('Alise will acheive victory.', []);

    expect(issues).toEqual([
      expect.objectContaining({
        word: 'acheive',
        suggestions: expect.arrayContaining(['achieve']),
      }),
      expect.objectContaining({
        word: 'Alise',
        suggestions: expect.arrayContaining(['Alice']),
      }),
    ]);
  });

  it('replaces whole-word misspellings without touching partial matches', async () => {
    const { replaceMisspelledWord } = await import('../../../src/lib/spellcheck.js');
    const updated = replaceMisspelledWord(
      'Alise met another Alise, but Malisen stayed behind.',
      'Alise',
      'Alice'
    );

    expect(updated).toBe('Alice met another Alice, but Malisen stayed behind.');
  });
});