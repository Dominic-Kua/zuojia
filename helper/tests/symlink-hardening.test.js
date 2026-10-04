import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { validateNovel } from '../src/index/validate.js';
import { createSnapshot } from '../src/backup/snapshot.js';
import { readWikiPage } from '../src/wiki/crud.js';
import { readChapter } from '../src/index/chapter.js';

/**
 * Shared novels can carry symlinks (git preserves them): `manuscript` or
 * `wiki` pointing outside the novel, or malicious entries inside them.
 * These tests plant such links and verify novel code refuses to follow.
 */
describe('symlink hardening', () => {
  let novelDir;
  let outsideDir;

  beforeEach(async () => {
    novelDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zuojia-symlink-novel-'));
    outsideDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zuojia-symlink-outside-'));
    for (const dir of ['manuscript', 'wiki', 'meta']) {
      await fsp.mkdir(path.join(novelDir, dir), { recursive: true });
    }
    await fsp.writeFile(path.join(novelDir, 'manuscript', 'chapter-01.md'), '# Chapter 1');
    await fsp.writeFile(path.join(novelDir, 'wiki', 'hero.md'), '# Hero');
    await fsp.writeFile(path.join(novelDir, 'meta', 'index.json'), '{}');
    await fsp.writeFile(path.join(outsideDir, 'secret.txt'), 'outside secret');
  });

  afterEach(async () => {
    await fsp.rm(novelDir, { recursive: true, force: true });
    await fsp.rm(outsideDir, { recursive: true, force: true });
  });

  it('validateNovel rejects a symlinked manuscript directory', async () => {
    await fsp.rm(path.join(novelDir, 'manuscript'), { recursive: true, force: true });
    fs.symlinkSync(outsideDir, path.join(novelDir, 'manuscript'));

    const result = await validateNovel(novelDir);

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_MANIFEST');
  });

  it('validateNovel rejects a symlinked wiki subdirectory root', async () => {
    await fsp.rm(path.join(novelDir, 'wiki'), { recursive: true, force: true });
    fs.symlinkSync(outsideDir, path.join(novelDir, 'wiki'));

    const result = await validateNovel(novelDir);

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_MANIFEST');
  });

  it('readChapter refuses a symlinked chapter pointing outside', async () => {
    fs.symlinkSync(
      path.join(outsideDir, 'secret.txt'),
      path.join(novelDir, 'manuscript', 'evil.md')
    );

    const result = await readChapter(novelDir, 'evil.md');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_PATH');
  });

  it('readWikiPage refuses a page reached through a symlinked subdir', async () => {
    await fsp.mkdir(path.join(novelDir, 'wiki', 'real'), { recursive: true });
    fs.symlinkSync(outsideDir, path.join(novelDir, 'wiki', 'sub'));

    const result = await readWikiPage(novelDir, 'sub/secret.txt');

    // Either refusal proves the outside file was not read.
    expect(result.status).toBe('error');
    if (result.error.code === 'ok') {
      throw new Error('expected an error envelope');
    }
    expect(result.data).toBeUndefined();
  });

  it('snapshot copies skip symlinked files instead of exfiltrating targets', async () => {
    fs.symlinkSync(
      path.join(outsideDir, 'secret.txt'),
      path.join(novelDir, 'wiki', 'evil.md')
    );

    const created = await createSnapshot(novelDir, 'symlink-test');
    expect(created.status).toBe('ok');

    const entries = await fsp.readdir(path.join(created.data.path, 'wiki'));
    expect(entries).not.toContain('evil.md');
    expect(entries).toContain('hero.md');
  });
});
