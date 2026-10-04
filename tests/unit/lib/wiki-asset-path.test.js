import { describe, it, expect } from 'vitest';
import { sanitizeWikiAssetPath, buildWikiAssetUrl } from '../../../src/lib/wiki-asset-path';

const NOVEL = '/Users/test/.zuojia/my-novel';

describe('sanitizeWikiAssetPath', () => {
  it('accepts plain filenames and subdirectories', () => {
    expect(sanitizeWikiAssetPath('map.png')).toEqual({ remote: false, path: 'map.png' });
    expect(sanitizeWikiAssetPath('places/map.png')).toEqual({ remote: false, path: 'places/map.png' });
  });

  it('encodes spaces, unicode, and query/fragment characters per segment', () => {
    expect(sanitizeWikiAssetPath('my map (1).png')).toEqual({
      remote: false,
      path: 'my%20map%20(1).png',
    });
    expect(sanitizeWikiAssetPath('a?b#c.png')).toEqual({ remote: false, path: 'a%3Fb%23c.png' });
  });

  it.each([
    ['parent traversal', '../../etc/passwd'],
    ['nested traversal', 'places/../../../secret'],
    ['absolute path', '/etc/passwd'],
    ['backslash traversal', '..\\..\\secret'],
    ['single dot', './map.png'],
    ['encoded traversal', '%2e%2e/%2e%2e/x'],
    ['double-encoded traversal', '%252e%252e/x'],
    ['empty', ''],
    ['blank', '   '],
    ['trailing slash', 'places/'],
  ])('refuses %s', (_, value) => {
    expect(sanitizeWikiAssetPath(value)).toBeNull();
  });

  it('passes remote embeds through', () => {
    expect(sanitizeWikiAssetPath('https://evil.example/t.png')).toEqual({
      remote: true,
      url: 'https://evil.example/t.png',
    });
  });
});

describe('buildWikiAssetUrl', () => {
  it('builds file URLs under the novel wiki dir', () => {
    expect(buildWikiAssetUrl(NOVEL, 'map.png')).toBe(`file://${NOVEL}/wiki/map.png`);
    expect(buildWikiAssetUrl(NOVEL, 'places/map.png')).toBe(`file://${NOVEL}/wiki/places/map.png`);
  });

  it('returns empty string for refused paths and missing novel', () => {
    expect(buildWikiAssetUrl(NOVEL, '../../etc/passwd')).toBe('');
    expect(buildWikiAssetUrl(NOVEL, '/etc/passwd')).toBe('');
    expect(buildWikiAssetUrl('', 'map.png')).toBe('');
    expect(buildWikiAssetUrl(null, 'map.png')).toBe('');
  });
});
