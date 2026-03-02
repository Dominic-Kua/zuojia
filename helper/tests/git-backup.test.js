import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import { backupAndPush } from '../src/git/backup.js';

// Mock execFileSync to avoid actual git operations
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

const TEST_DIR = path.join(process.cwd(), 'test-backup-' + Date.now());

describe('backupAndPush', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should return error if novel path is null', async () => {
    const result = await backupAndPush(null);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });

  it('should return error if novel path is undefined', async () => {
    const result = await backupAndPush(undefined);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });

  it('should return error if novel path is empty string', async () => {
    const result = await backupAndPush('');
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });

  it('should return error if novel path does not exist', async () => {
    const result = await backupAndPush('/nonexistent/path/to/novel');
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });

  it('should initialize git repo if .git does not exist', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return '';
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    // Should call git init, config user.name, config user.email
    const initCalls = execFileSync.mock.calls.filter(
      call => call[0] === 'git' && call[1][0] === 'init'
    );
    expect(initCalls.length).toBeGreaterThan(0);
    
    const configCalls = execFileSync.mock.calls.filter(
      call => call[0] === 'git' && call[1][0] === 'config'
    );
    expect(configCalls.length).toBe(2); // user.name and user.email
  });

  it('should not initialize git repo if .git already exists', async () => {
    // Create .git directory
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return '';
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    // Should NOT call git init
    const initCalls = execFileSync.mock.calls.filter(
      call => call[0] === 'git' && call[1][0] === 'init'
    );
    expect(initCalls.length).toBe(0);
  });

  it('should return error if git init fails', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'init') {
        throw new Error('Permission denied');
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('GIT_INIT_FAILED');
  });

  it('should return error if git status fails', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        throw new Error('Not a git repository');
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('GIT_STATUS_FAILED');
  });

  it('should not commit if no changed files', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return ''; // No changed files
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('ok');
    expect(result.data.committed).toBe(false);
    expect(result.data.pushed).toBe(true);
    expect(result.data.files).toEqual([]);
    
    // Should not call git add or git commit
    const addCalls = execFileSync.mock.calls.filter(
      call => call[0] === 'git' && call[1][0] === 'add'
    );
    expect(addCalls.length).toBe(0);
    
    const commitCalls = execFileSync.mock.calls.filter(
      call => call[0] === 'git' && call[1][0] === 'commit'
    );
    expect(commitCalls.length).toBe(0);
  });

  it('should commit changed files', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return ' M chapter-01.md\n A chapter-02.md';
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('ok');
    expect(result.data.committed).toBe(true);
    expect(result.data.pushed).toBe(true);
    expect(result.data.files).toEqual(['chapter-01.md', 'chapter-02.md']);
    expect(result.data.message).toContain('backup:');
    expect(result.data.message).toContain('chapter-01.md, chapter-02.md');
  });

  it('should return error if git add fails', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return ' M chapter-01.md';
      }
      if (cmd === 'git' && args[0] === 'add') {
        throw new Error('Permission denied');
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('GIT_ADD_FAILED');
  });

  it('should return error if git commit fails', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return ' M chapter-01.md';
      }
      if (cmd === 'git' && args[0] === 'commit') {
        const err = new Error('Commit failed');
        err.message = 'Author identity unknown';
        throw err;
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('GIT_COMMIT_FAILED');
  });

  it('should handle "nothing to commit" gracefully', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return ' M chapter-01.md';
      }
      if (cmd === 'git' && args[0] === 'commit') {
        const err = new Error('nothing to commit, working tree clean');
        throw err;
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    // Should NOT return error for "nothing to commit"
    expect(result.status).toBe('ok');
  });

  it('should return error if git push fails', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return '';
      }
      if (cmd === 'git' && args[0] === 'push') {
        throw new Error('No remote configured');
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('GIT_PUSH_FAILED');
  });

  it('should include timestamp in result', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return '';
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const beforeTime = Date.now();
    const result = await backupAndPush(TEST_DIR);
    const afterTime = Date.now();
    
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).getTime()).toBeGreaterThanOrEqual(beforeTime);
    expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(afterTime);
  });

  it('should handle paths with spaces', async () => {
    const spacePath = path.join(TEST_DIR, 'novel with spaces');
    await mkdir(spacePath, { recursive: true });
    const gitDir = path.join(spacePath, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return '';
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(spacePath);
    
    expect(result.status).toBe('ok');
  });

  it('should handle many changed files', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    // Generate 100 changed files
    const manyFiles = Array.from({ length: 100 }, (_, i) => ` M chapter-${i.toString().padStart(3, '0')}.md`).join('\n');

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return manyFiles;
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('ok');
    expect(result.data.files).toHaveLength(100);
    expect(result.data.committed).toBe(true);
  });

  it('should handle UTF-8 filenames', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return ' M chapter-日本語.md\n M chapitre-français.md';
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('ok');
    expect(result.data.files).toContain('chapter-日本語.md');
    expect(result.data.files).toContain('chapitre-français.md');
  });

  it('should parse git status porcelain format correctly', async () => {
    const gitDir = path.join(TEST_DIR, '.git');
    await mkdir(gitDir, { recursive: true });

    // Test various git status formats
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') {
        return ' M modified.md\n A  added.md\n D  deleted.md\n?? untracked.md';
      }
      if (cmd === 'git' && args[0] === 'push') {
        return '';
      }
    });

    const result = await backupAndPush(TEST_DIR);
    
    expect(result.status).toBe('ok');
    expect(result.data.files).toEqual(['modified.md', 'added.md', 'deleted.md', 'untracked.md']);
  });
});
