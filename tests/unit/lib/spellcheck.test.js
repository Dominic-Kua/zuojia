import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const affContent = readFileSync(
  resolve(process.cwd(), 'node_modules/dictionary-en-gb/index.aff'),
  'utf8'
);
const dicContent = readFileSync(
  resolve(process.cwd(), 'node_modules/dictionary-en-gb/index.dic'),
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

    expect(issues).toHaveLength(2);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: 'acheive',
          suggestions: expect.arrayContaining(['achieve']),
        }),
        expect.objectContaining({
          word: 'Alise',
          suggestions: expect.arrayContaining(['Alice']),
        }),
      ])
    );
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

  it('replaces Unicode words (accents, Nordic, ligatures) using Unicode-aware boundaries', async () => {
    const { replaceMisspelledWord } = await import('../../../src/lib/spellcheck.js');

    const cases = [
      ['Mbacké met Mbackéx, then Mbacké.', 'Mbacké', 'Mbake', 'Mbake met Mbackéx, then Mbake.'],
      ['Åse greeted Åsen, but Åse smiled.', 'Åse', 'Ase', 'Ase greeted Åsen, but Ase smiled.'],
      ['Søren saw Sørensen and Søren left.', 'Søren', 'Soren', 'Soren saw Sørensen and Soren left.'],
      ['Æthelred met Æthelreda; Æthelred ruled.', 'Æthelred', 'Aethelred', 'Aethelred met Æthelreda; Aethelred ruled.'],
      ['Œuvre and Œuvres, but Œuvre stands.', 'Œuvre', 'Oeuvre', 'Oeuvre and Œuvres, but Oeuvre stands.'],
      ['Þrúðr met Þrúðrx; Þrúðr spoke.', 'Þrúðr', 'Thrudr', 'Thrudr met Þrúðrx; Thrudr spoke.'],
      ['Łukasz saw Łukasza, then Łukasz.', 'Łukasz', 'Lukasz', 'Lukasz saw Łukasza, then Lukasz.'],
      ["O'Björk met O'Björkx; O'Björk sang.", "O'Björk", "O'Bjork", "O'Bjork met O'Björkx; O'Bjork sang."],
    ];

    for (const [text, original, replacement, expected] of cases) {
      expect(replaceMisspelledWord(text, original, replacement), `replace "${original}"`).toBe(expected);
    }
  });

  it('uses UK English dictionary conventions', async () => {
    const { findMisspelledWords } = await import('../../../src/lib/spellcheck.js');
    const misspelled = await findMisspelledWords('The colour is bright but the color is odd.', []);

    expect(misspelled).toContain('color');
    expect(misspelled).not.toContain('colour');
  });

  it('suppresses possessive forms of custom dictionary words', async () => {
    const { findMisspelledWords } = await import('../../../src/lib/spellcheck.js');
    const misspelled = await findMisspelledWords(
      "Dominic's quest led him to Frodo's ring and Baggins' lair.",
      ['Dominic', 'Frodo', 'Baggins']
    );

    expect(misspelled).not.toContain("Dominic's");
    expect(misspelled).not.toContain("Frodo's");
    expect(misspelled).not.toContain("Baggins'");
  });

  it('still flags misspelled possessives not in the dictionary', async () => {
    const { findMisspelledWords } = await import('../../../src/lib/spellcheck.js');
    const misspelled = await findMisspelledWords("Xyzqt's plan was bold.", []);

    expect(misspelled).toContain("Xyzqt's");
  });
});