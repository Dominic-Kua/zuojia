import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { execFileSync } from 'child_process';
import { createSnapshot } from '../src/backup/snapshot.js';
import { listChangedFiles, createManualCommit, getCommitHistory } from '../src/git/commit.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('../src/backup/snapshot.js', () => ({
  createSnapshot: vi.fn(),
}));

describe('manual git commit helpers', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-manual-commit-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
    await fs.mkdir(path.join(testDir, '.git'), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('lists changed manuscript files from git status', async () => {
    execFileSync.mockReturnValue(' M manuscript/chapter-01.md\n?? manuscript/chapter-02.md\n M wiki/page.md\n');

    const result = await listChangedFiles(testDir);

    expect(result.status).toBe('ok');
    expect(result.data.files).toEqual([
      'manuscript/chapter-01.md',
      'manuscript/chapter-02.md',
    ]);
  });

  it('returns error for invalid novel path when listing changes', async () => {
    const result = await listChangedFiles('/nope');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });

  it('creates a manual commit with snapshot first', async () => {
    createSnapshot.mockResolvedValue({
      status: 'ok',
      data: { timestamp: 111, label: 'pre-commit: Save work', path: '/snap' },
    });

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd !== 'git') {
        throw new Error('unexpected command');
      }
      if (args[0] === 'status') return ' M manuscript/chapter-01.md\n';
      if (args[0] === 'add') return '';
      if (args[0] === 'commit') return '';
      if (args[0] === 'rev-parse') return 'abc1234def5678\n';
      if (args[0] === 'config') return 'zuojia\n';
      throw new Error('unexpected git args: ' + args.join(' '));
    });

    const result = await createManualCommit(testDir, ['manuscript/chapter-01.md'], 'Save work');

    expect(createSnapshot).toHaveBeenCalledWith(testDir, 'pre-commit: Save work');
    expect(execFileSync).toHaveBeenCalledWith('git', ['add', '--', 'manuscript/chapter-01.md'], expect.any(Object));
    expect(execFileSync).toHaveBeenCalledWith('git', ['commit', '-m', 'Save work'], expect.any(Object));
    expect(result.status).toBe('ok');
    expect(result.data.hash).toBe('abc1234');
    expect(result.data.message).toBe('Save work');
    expect(result.data.snapshot.timestamp).toBe(111);
  });

  it('rejects empty file selection', async () => {
    const result = await createManualCommit(testDir, [], 'Save work');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('NO_FILES_SELECTED');
  });

  it('rejects empty commit message', async () => {
    const result = await createManualCommit(testDir, ['manuscript/chapter-01.md'], '   ');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_COMMIT_MESSAGE');
  });

  it('rejects files that are not currently changed', async () => {
    execFileSync.mockReturnValue(' M manuscript/chapter-01.md\n');

    const result = await createManualCommit(testDir, ['manuscript/chapter-02.md'], 'Save work');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_SELECTED_FILE');
  });

  it('rejects path traversal via sibling directory prefix trick', async () => {
    const result = await createManualCommit(testDir, ['manuscript-evil/secret.md'], 'Save work');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_PATH_TRAVERSAL');
  });

  it('rejects path traversal via parent directory escape', async () => {
    const result = await createManualCommit(testDir, ['manuscript/../outside.md'], 'Save work');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_PATH_TRAVERSAL');
  });

  it('returns snapshot failure without attempting git commit', async () => {
    createSnapshot.mockResolvedValue({
      status: 'error',
      error: { code: 'SNAPSHOT_CREATE_FAILED', message: 'snapshot failed' },
    });
    execFileSync.mockReturnValue(' M manuscript/chapter-01.md\n');

    const result = await createManualCommit(testDir, ['manuscript/chapter-01.md'], 'Save work');

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SNAPSHOT_CREATE_FAILED');
    const gitCommands = execFileSync.mock.calls.map((call) => call[1][0]);
    expect(gitCommands).toEqual(['status']);
  });

  it('returns recent commit history', async () => {
    execFileSync.mockReturnValue('abc1234|Add opening\n9876543|Fix chapter\n');

    const result = await getCommitHistory(testDir, 2);

    expect(result.status).toBe('ok');
    expect(result.data.commits).toEqual([
      { hash: 'abc1234', message: 'Add opening' },
      { hash: '9876543', message: 'Fix chapter' },
    ]);
  });

  it('returns an empty history for repos without commits yet', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (args[0] === 'log') {
        const error = new Error('fatal: your current branch does not have any commits yet');
        error.stderr = 'fatal: your current branch does not have any commits yet';
        throw error;
      }
      return '';
    });

    const result = await getCommitHistory(testDir, 5);

    expect(result.status).toBe('ok');
    expect(result.data.commits).toEqual([]);
  });
});
