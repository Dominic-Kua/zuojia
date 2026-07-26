// @vitest-environment node

import { describe, it, expect } from 'vitest';

describe('expandHome', () => {
  it('returns falsy values as-is', async () => {
    const { expandHome } = await import('../../helper/src/util/path-helpers.js');
    expect(expandHome('')).toBe('');
    expect(expandHome(null)).toBe(null);
    expect(expandHome(undefined)).toBe(undefined);
  });

  it('expands ~ to home directory', async () => {
    const { expandHome } = await import('../../helper/src/util/path-helpers.js');
    const result = expandHome('~');
    expect(result).not.toBe('~');
    expect(result.length).toBeGreaterThan(0);
  });

  it('expands ~/path to home/path', async () => {
    const { expandHome } = await import('../../helper/src/util/path-helpers.js');
    const result = expandHome('~/Documents/novels');
    expect(result).not.toContain('~');
    expect(result).toContain('Documents');
    expect(result).toContain('novels');
  });

  it('returns absolute paths unchanged', async () => {
    const { expandHome } = await import('../../helper/src/util/path-helpers.js');
    expect(expandHome('/opt/homebrew/bin')).toBe('/opt/homebrew/bin');
  });
});

describe('getManuscriptWordCount', () => {
  it('throws for non-existent novel path', async () => {
    const { getManuscriptWordCount } = await import('../../helper/src/stats/manuscript-count.js');
    await expect(getManuscriptWordCount('/tmp/nonexistent-novel')).rejects.toThrow('does not exist');
  });

  it('counts words in a single chapter', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { getManuscriptWordCount } = await import('../../helper/src/stats/manuscript-count.js');

    const novelDir = '/tmp/test-manuscript-count';
    const manuscriptDir = path.join(novelDir, 'manuscript');
    await fs.default.mkdir(manuscriptDir, { recursive: true });
    await fs.default.writeFile(path.join(manuscriptDir, 'chapter01.md'), 'Hello world this is a test chapter');

    try {
      const count = await getManuscriptWordCount(novelDir);
      expect(count).toBe(7);
    } finally {
      await fs.default.rm(novelDir, { recursive: true, force: true });
    }
  });

  it('counts words across multiple chapters', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { getManuscriptWordCount } = await import('../../helper/src/stats/manuscript-count.js');

    const novelDir = '/tmp/test-manuscript-count-multi';
    const manuscriptDir = path.join(novelDir, 'manuscript');
    await fs.default.mkdir(manuscriptDir, { recursive: true });
    await fs.default.writeFile(path.join(manuscriptDir, 'chapter01.md'), 'Three words here');
    await fs.default.writeFile(path.join(manuscriptDir, 'chapter02.md'), 'Four words here too');

    try {
      const count = await getManuscriptWordCount(novelDir);
      expect(count).toBe(7);
    } finally {
      await fs.default.rm(novelDir, { recursive: true, force: true });
    }
  });

  it('skips hidden files and non-markdown files', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { getManuscriptWordCount } = await import('../../helper/src/stats/manuscript-count.js');

    const novelDir = '/tmp/test-manuscript-count-skip';
    const manuscriptDir = path.join(novelDir, 'manuscript');
    await fs.default.mkdir(manuscriptDir, { recursive: true });
    await fs.default.writeFile(path.join(manuscriptDir, 'chapter01.md'), 'Only this counts');
    await fs.default.writeFile(path.join(manuscriptDir, '.hidden.md'), 'Should not count');
    await fs.default.writeFile(path.join(manuscriptDir, 'notes.txt'), 'Should not count');

    try {
      const count = await getManuscriptWordCount(novelDir);
      expect(count).toBe(3);
    } finally {
      await fs.default.rm(novelDir, { recursive: true, force: true });
    }
  });

  it('recurses into subdirectories', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { getManuscriptWordCount } = await import('../../helper/src/stats/manuscript-count.js');

    const novelDir = '/tmp/test-manuscript-count-recurse';
    const manuscriptDir = path.join(novelDir, 'manuscript', 'part1');
    await fs.default.mkdir(manuscriptDir, { recursive: true });
    await fs.default.writeFile(path.join(manuscriptDir, 'chapter01.md'), 'Nested words here');

    try {
      const count = await getManuscriptWordCount(novelDir);
      expect(count).toBe(3);
    } finally {
      await fs.default.rm(novelDir, { recursive: true, force: true });
    }
  });
});
