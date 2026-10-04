import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { ensureNovelGitignore, NOVEL_GITIGNORE_LINES } from '../src/git/gitignore.js';

describe('novel .gitignore', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-gitignore-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('writes generated-dir exclusions when .gitignore is missing', async () => {
    ensureNovelGitignore(testDir);

    const content = await fs.readFile(path.join(testDir, '.gitignore'), 'utf-8');
    for (const line of NOVEL_GITIGNORE_LINES) {
      expect(content).toContain(line);
    }
  });

  it('never touches an existing .gitignore', async () => {
    await fs.writeFile(path.join(testDir, '.gitignore'), 'my-custom-rule\n', 'utf-8');

    ensureNovelGitignore(testDir);

    const content = await fs.readFile(path.join(testDir, '.gitignore'), 'utf-8');
    expect(content).toBe('my-custom-rule\n');
  });
});
