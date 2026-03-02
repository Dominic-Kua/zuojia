import { describe, it, expect } from 'vitest';
import {
  parseWikiLink,
  extractWikiLinks,
  resolveWikiLink,
  normalizeSlug,
  findAmbiguousMatches,
} from '../../../src/lib/wiki-link';

describe('Wiki Link Utilities', () => {
  describe('parseWikiLink', () => {
    it('parses simple wiki link', () => {
      const result = parseWikiLink('[[Alice]]');
      expect(result).toEqual({
        target: 'alice',
        display: 'Alice',
        raw: '[[Alice]]',
      });
    });

    it('parses wiki link with custom display text', () => {
      const result = parseWikiLink('[[alice-protagonist|Alice the Protagonist]]');
      expect(result).toEqual({
        target: 'alice-protagonist',
        display: 'Alice the Protagonist',
        raw: '[[alice-protagonist|Alice the Protagonist]]',
      });
    });

    it('returns null for invalid syntax', () => {
      expect(parseWikiLink('[[invalid')).toBeNull();
      expect(parseWikiLink('invalid]]')).toBeNull();
      expect(parseWikiLink('[[]]')).toBeNull();
    });

    it('handles whitespace gracefully', () => {
      const result = parseWikiLink('[[ Alice ]]');
      expect(result).toEqual({
        target: 'alice',
        display: 'Alice',
        raw: '[[ Alice ]]',
      });
    });
  });

  describe('extractWikiLinks', () => {
    it('extracts all wiki links from content', () => {
      const content = `
        Alice visited [[the-forest]]. She met [[bob-merchant|Bob the Merchant]].
        Then she went to [[the-forest]] again.
      `;
      const links = extractWikiLinks(content);
      expect(links).toHaveLength(3);
      expect(links[0].target).toBe('the-forest');
      expect(links[1].target).toBe('bob-merchant');
      expect(links[2].target).toBe('the-forest');
    });

    it('returns empty array for content with no wiki links', () => {
      const content = 'This is regular text with no wiki links.';
      expect(extractWikiLinks(content)).toEqual([]);
    });

    it('handles nested brackets', () => {
      const content = 'Text with [[link1]] and [[link2]] but not [regular brackets]';
      const links = extractWikiLinks(content);
      expect(links).toHaveLength(2);
      expect(links.map(l => l.target)).toEqual(['link1', 'link2']);
    });
  });

  describe('normalizeSlug', () => {
    it('converts title to slug', () => {
      expect(normalizeSlug('Alice the Protagonist')).toBe('alice-the-protagonist');
      expect(normalizeSlug('The Forest')).toBe('the-forest');
      expect(normalizeSlug('Bob (The Merchant)')).toBe('bob-the-merchant');
    });

    it('handles multiple spaces and special characters', () => {
      expect(normalizeSlug('City   of   Light')).toBe('city-of-light');
      expect(normalizeSlug("King's Crown!")).toBe('kings-crown');
    });

    it('lowercases and preserves unicode characters', () => {
      expect(normalizeSlug('Café Lumière')).toBe('cafe-lumiere');
    });

    it('handles already-normalized slugs', () => {
      expect(normalizeSlug('alice-protagonist')).toBe('alice-protagonist');
    });
  });

  describe('resolveWikiLink', () => {
    const wikiPages = [
      { slug: 'alice', title: 'Alice the Protagonist', filepath: '' },
      { slug: 'the-forest', title: 'The Forest', filepath: '' },
      { slug: 'bob-merchant', title: 'Bob the Merchant', filepath: '' },
    ];

    it('resolves exact slug match', () => {
      const result = resolveWikiLink('alice', wikiPages);
      expect(result).toEqual({
        found: true,
        matches: [{ slug: 'alice', title: 'Alice the Protagonist', filepath: '' }],
      });
    });

    it('returns not found for non-existent slug', () => {
      const result = resolveWikiLink('nonexistent', wikiPages);
      expect(result).toEqual({
        found: false,
        matches: [],
      });
    });

    it('returns found when exact slug exists', () => {
      const pages = [
        { slug: 'alice', title: 'Alice', filepath: '' },
        { slug: 'alice-protagonist', title: 'Alice the Protagonist', filepath: '' },
        { slug: 'alice-antagonist', title: 'Alice the Antagonist', filepath: '' },
      ];
      const result = resolveWikiLink('alice', pages);
      expect(result.found).toBe(true);
      expect(result.matches).toHaveLength(1);
    });

    it('finds partial matches for disambiguation when no exact match exists', () => {
      const pages = [
        { slug: 'alice-protagonist', title: 'Alice the Protagonist', filepath: '' },
        { slug: 'alice-antagonist', title: 'Alice the Antagonist', filepath: '' },
        { slug: 'alice-secondary', title: 'Alice Secondary', filepath: '' },
      ];
      const result = resolveWikiLink('alice', pages);
      expect(result.found).toBe(false);
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  describe('findAmbiguousMatches', () => {
    const wikiPages = [
      { slug: 'alice', title: 'Alice the Protagonist', filepath: '' },
      { slug: 'alice-antagonist', title: 'Alice the Antagonist', filepath: '' },
      { slug: 'alice-secondary', title: 'Alice Secondary', filepath: '' },
    ];

    it('finds all pages with similar title/slug', () => {
      const matches = findAmbiguousMatches('alice', wikiPages);
      expect(matches).toHaveLength(3);
      expect(matches.map(m => m.slug)).toEqual([
        'alice',
        'alice-antagonist',
        'alice-secondary',
      ]);
    });

    it('returns empty array when no matches', () => {
      const matches = findAmbiguousMatches('nonexistent', wikiPages);
      expect(matches).toEqual([]);
    });
  });
});
