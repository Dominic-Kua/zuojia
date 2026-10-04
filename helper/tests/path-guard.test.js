import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveContainedPath, isWithinDir, isSymlink } from '../src/util/path-guard.js';

let ROOT;
let OUTSIDE;

beforeEach(() => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-root-'));
  OUTSIDE = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-out-'));
  fs.mkdirSync(path.join(ROOT, 'manuscript'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'manuscript', 'chapter-01.md'), '# Hi');
  fs.writeFileSync(path.join(OUTSIDE, 'secret.txt'), 'secret');
});

afterEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.rmSync(OUTSIDE, { recursive: true, force: true });
});

describe('resolveContainedPath', () => {
  it('resolves ordinary files inside the root', () => {
    const p = resolveContainedPath(path.join(ROOT, 'manuscript'), 'chapter-01.md');
    expect(p).toBe(path.join(fs.realpathSync(ROOT), 'manuscript', 'chapter-01.md'));
  });

  it('resolves fresh-write targets that do not exist yet', () => {
    const p = resolveContainedPath(path.join(ROOT, 'manuscript'), 'chapter-02.md');
    expect(p).toBe(path.join(fs.realpathSync(ROOT), 'manuscript', 'chapter-02.md'));
  });

  it('rejects lexical traversal', () => {
    expect(resolveContainedPath(path.join(ROOT, 'manuscript'), '..', 'secret.txt')).toBeNull();
  });

  it('rejects a symlinked file pointing outside', () => {
    fs.symlinkSync(path.join(OUTSIDE, 'secret.txt'), path.join(ROOT, 'manuscript', 'evil.md'));
    expect(resolveContainedPath(path.join(ROOT, 'manuscript'), 'evil.md')).toBeNull();
  });

  it('rejects paths through a symlinked subdirectory pointing outside', () => {
    fs.symlinkSync(OUTSIDE, path.join(ROOT, 'manuscript', 'sub'));
    expect(resolveContainedPath(path.join(ROOT, 'manuscript'), 'sub', 'secret.txt')).toBeNull();
  });

  it('rejects a dangling symlink final component (writes would follow it)', () => {
    fs.symlinkSync(path.join(OUTSIDE, 'nope.txt'), path.join(ROOT, 'manuscript', 'dangling.md'));
    expect(resolveContainedPath(path.join(ROOT, 'manuscript'), 'dangling.md')).toBeNull();
  });

  it('rejects even inside-root symlinks (strict: symlinked finals are never followed)', () => {
    fs.symlinkSync(
      path.join(ROOT, 'manuscript', 'chapter-01.md'),
      path.join(ROOT, 'manuscript', 'alias.md')
    );
    expect(resolveContainedPath(path.join(ROOT, 'manuscript'), 'alias.md')).toBeNull();
  });

  it('returns null for a missing root', () => {
    expect(resolveContainedPath(path.join(ROOT, 'nope'), 'x.md')).toBeNull();
  });
});

describe('isSymlink / isWithinDir', () => {
  it('detects symlinks without following them', () => {
    const link = path.join(ROOT, 'link');
    fs.symlinkSync(path.join(OUTSIDE, 'secret.txt'), link);
    expect(isSymlink(link)).toBe(true);
    expect(isSymlink(path.join(ROOT, 'manuscript', 'chapter-01.md'))).toBe(false);
    expect(isSymlink(path.join(ROOT, 'missing'))).toBe(false);
  });

  it('checks containment on resolved paths', () => {
    const rootReal = fs.realpathSync(ROOT);
    expect(isWithinDir(rootReal, path.join(rootReal, 'a', 'b'))).toBe(true);
    expect(isWithinDir(rootReal, rootReal)).toBe(true);
    expect(isWithinDir(rootReal, OUTSIDE)).toBe(false);
    expect(isWithinDir(null, rootReal)).toBe(false);
  });
});
