import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { execFileSync, execFile } from 'child_process';
import { getGitSettings, saveGitSettings } from '../src/git/config.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

const TEST_DIR = path.join(process.cwd(), `test-git-config-${Date.now()}`);

describe('git config helpers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.mkdir(path.join(TEST_DIR, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns default git settings when config file does not exist', async () => {
    const result = await getGitSettings(TEST_DIR);

    expect(result.status).toBe('ok');
    expect(result.data).toEqual({
      remoteUrl: '',
      branch: 'main',
      sshKeyPath: '~/.ssh/id_rsa',
    });
  });

  it('saves validated git settings to meta/config.yml', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (cmd === 'git' && args[0] === 'ls-remote') {
        cb(null, 'abc123\trefs/heads/main\n', '');
      } else {
        cb(new Error(`unexpected command ${cmd} ${args.join(' ')}`));
      }
    });

    const result = await saveGitSettings(TEST_DIR, {
      remoteUrl: 'https://github.com/user/repo.git',
      branch: '',
      sshKeyPath: '',
    });

    expect(result.status).toBe('ok');
    expect(result.data.branch).toBe('main');
    expect(result.data.sshKeyPath).toBe('~/.ssh/id_rsa');

    const saved = await fs.readFile(path.join(TEST_DIR, 'meta', 'config.yml'), 'utf-8');
    expect(saved).toContain('remoteUrl: https://github.com/user/repo.git');
    expect(saved).toContain('branch: main');
    expect(saved).toContain('sshKeyPath: ~/.ssh/id_rsa');
  });

  it('does not persist config when remote validation fails', async () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (cmd === 'git' && args[0] === 'ls-remote') {
        cb(new Error('fatal: repository not found'));
      } else {
        cb(new Error(`unexpected command ${cmd} ${args.join(' ')}`));
      }
    });

    const result = await saveGitSettings(TEST_DIR, {
      remoteUrl: 'https://github.com/user/missing.git',
      branch: 'drafts',
      sshKeyPath: '~/.ssh/id_rsa',
    });

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('REMOTE_UNREACHABLE');
    await expect(fs.readFile(path.join(TEST_DIR, 'meta', 'config.yml'), 'utf-8')).rejects.toThrow();
  });
});