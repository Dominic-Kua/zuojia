/**
 * Tests for wiki link parser
 */

import { describe, it, expect } from 'vitest';
import { parseWikiLinks, resolveSlug, isValidLink } from '../../../src/lib/wiki-link-parser.js';

describe('parseWikiLinks', () => {
  it('parses simple wiki link', () => {
    const text = 'This is about [[Alice]].';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      start: 14,
      end: 23,
      pageName: 'Alice',
      displayText: 'Alice',
      fullMatch: '[[Alice]]',
    });
  });

  it('parses wiki link with display text', () => {
    const text = 'Meet [[alice|the protagonist]].';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      start: 5,
      end: 30,
      pageName: 'alice',
      displayText: 'the protagonist',
      fullMatch: '[[alice|the protagonist]]',
    });
  });

  it('parses multiple wiki links', () => {
    const text = '[[Alice]] and [[Bob]] are characters.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(2);
    expect(links[0].pageName).toBe('Alice');
    expect(links[1].pageName).toBe('Bob');
  });

  it('handles wiki links with spaces in name', () => {
    const text = 'Visit [[New York City]].';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe('New York City');
  });

  it('handles wiki links with hyphens', () => {
    const text = 'See [[alice-the-protagonist]].';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe('alice-the-protagonist');
  });

  it('ignores single brackets', () => {
    const text = 'This [is] not a link.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(0);
  });

  it('ignores triple brackets', () => {
    const text = 'This [[[is]]] not valid.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(0);
  });

  it('handles empty brackets', () => {
    const text = 'This [[]] is empty.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(0);
  });

  it('rejects link with empty page name but display text', () => {
    const text = 'This [[|display]] is malformed.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(0);
  });

  it('rejects link with whitespace-only page name but display text', () => {
    const text = 'This [[  |display]] is also malformed.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(0);
  });
  it('handles nested brackets in page name', () => {
    const text = 'This [[page [with] brackets]] exists.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe('page [with] brackets');
  });

  it('handles link with pipe separator and display text', () => {
    const text = 'See [[page|name]].';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe('page');
    expect(links[0].displayText).toBe('name');
  });

  it('handles empty display text after pipe', () => {
    const text = 'See [[page|]].';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe('page');
    expect(links[0].displayText).toBe('page');
  });
  it('handles multiple pipes (uses first as separator)', () => {
    const text = '[[page|display|extra]].';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].pageName).toBe('page');
    expect(links[0].displayText).toBe('display|extra');
  });

  it('handles links at start of text', () => {
    const text = '[[Alice]] is here.';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].start).toBe(0);
  });

  it('handles links at end of text', () => {
    const text = 'See [[Alice]]';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(1);
    expect(links[0].end).toBe(13);
  });

  it('returns empty array for text without links', () => {
    const text = 'This text has no wiki links.';
    const links = parseWikiLinks(text);

    expect(links).toEqual([]);
  });

  it('handles adjacent wiki links', () => {
    const text = '[[Alice]][[Bob]]';
    const links = parseWikiLinks(text);

    expect(links).toHaveLength(2);
    expect(links[0].pageName).toBe('Alice');
    expect(links[1].pageName).toBe('Bob');
  });
});

describe('resolveSlug', () => {
  it('converts page name to slug', () => {
    expect(resolveSlug('Alice the Protagonist')).toBe('alice-the-protagonist');
  });

  it('converts to lowercase', () => {
    expect(resolveSlug('NEW YORK')).toBe('new-york');
  });

  it('replaces spaces with hyphens', () => {
    expect(resolveSlug('The Green Dragon')).toBe('the-green-dragon');
  });

  it('removes special characters', () => {
    expect(resolveSlug('Alice\'s Place!')).toBe('alices-place');
  });

  it('handles multiple consecutive spaces', () => {
    expect(resolveSlug('Alice   the   Hero')).toBe('alice-the-hero');
  });

  it('removes leading/trailing spaces', () => {
    expect(resolveSlug('  Alice  ')).toBe('alice');
  });

  it('handles empty string', () => {
    expect(resolveSlug('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(resolveSlug('!!!')).toBe('');
  });

  it('preserves existing hyphens', () => {
    expect(resolveSlug('alice-the-hero')).toBe('alice-the-hero');
  });

  it('removes multiple consecutive hyphens', () => {
    expect(resolveSlug('alice---hero')).toBe('alice-hero');
  });

  it('handles unicode characters', () => {
    // Accented letters are preserved (unicode-aware slugifier, matches
    // helper backend and normalizeSlug in wiki-link.js)
    expect(resolveSlug('Café René')).toBe('café-rené');
  });

  it('preserves CJK characters in slugs', () => {
    expect(resolveSlug('林黛玉')).toBe('林黛玉');
    expect(resolveSlug('人物/贾宝玉')).toBe('人物/贾宝玉');
    // Punctuation that isn't a letter/number is dropped, not slug-breaking
    expect(resolveSlug('大观园（贾府）')).toBe('大观园贾府');
  });

  it('preserves path separators in subdirectory slugs', () => {
    expect(resolveSlug('characters/Alice')).toBe('characters/alice');
    expect(resolveSlug('locations/The Forest')).toBe('locations/the-forest');
  });

  it('normalizes each path segment independently', () => {
    expect(resolveSlug('Characters/Arkid_deedie')).toBe('characters/arkid-deedie');
    expect(resolveSlug('Locations/New York City')).toBe('locations/new-york-city');
  });

  it('handles deeply nested paths', () => {
    expect(resolveSlug('world/places/cities/new-york')).toBe('world/places/cities/new-york');
  });

  it('strips empty path segments', () => {
    expect(resolveSlug('/characters/alice')).toBe('characters/alice');
    expect(resolveSlug('characters//alice')).toBe('characters/alice');
  });
});

describe('isValidLink', () => {
  it('validates correct link format', () => {
    expect(isValidLink('[[Alice]]')).toBe(true);
  });

  it('validates link with display text', () => {
    expect(isValidLink('[[Alice|the hero]]')).toBe(true);
  });

  it('rejects single brackets', () => {
    expect(isValidLink('[Alice]')).toBe(false);
  });

  it('rejects triple brackets', () => {
    expect(isValidLink('[[[Alice]]]')).toBe(false);
  });

  it('rejects empty brackets', () => {
    expect(isValidLink('[[]]')).toBe(false);
  });

  it('rejects brackets with only spaces', () => {
    expect(isValidLink('[[   ]]')).toBe(false);
  });

  it('accepts links with spaces', () => {
    expect(isValidLink('[[New York]]')).toBe(true);
  });

  it('rejects malformed brackets', () => {
    expect(isValidLink('[[Alice]')).toBe(false);
    expect(isValidLink('[Alice]]')).toBe(false);
  });
});
