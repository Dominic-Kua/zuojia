import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { execFileSync, execFile } from 'child_process';
import { getGitSettings, saveGitSettings, loadGitConfig } from '../src/git/config.js';

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
      sshKeyPath: '',
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
    // Blank key stays "auto" (ssh-agent / default keys) instead of forcing id_rsa.
    expect(result.data.sshKeyPath).toBe('');

    const saved = await fs.readFile(path.join(TEST_DIR, 'meta', 'config.yml'), 'utf-8');
    expect(saved).toContain('remoteUrl: https://github.com/user/repo.git');
    expect(saved).toContain('branch: main');
    expect(saved).toContain('sshKeyPath:');
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

describe('git config trust hardening', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.mkdir(path.join(TEST_DIR, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it.each([
    ['ext transport', 'ext::sh -c touch /tmp/pwned'],
    ['uppercase EXT transport', 'EXT::sh -c touch /tmp/pwned'],
    ['fd transport', 'fd::17'],
  ])('saveGitSettings rejects %s without running ls-remote', async (_, badUrl) => {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, 'should-never-run', '');
    });

    const result = await saveGitSettings(TEST_DIR, {
      remoteUrl: badUrl,
      branch: 'main',
      sshKeyPath: '',
    });

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('UNSAFE_REMOTE_URL');
    // The forbidden transport must never reach a git subprocess.
    expect(execFile).not.toHaveBeenCalled();
    await expect(fs.readFile(path.join(TEST_DIR, 'meta', 'config.yml'), 'utf-8')).rejects.toThrow();
  });

  it.each([
    ['upload-pack flag', '--upload-pack=touch /tmp/pwned'],
    ['leading dash', '-pwn'],
    ['parent traversal', 'a/../b'],
    ['at-brace', 'a@{u}'],
    ['spaces', 'my branch'],
  ])('saveGitSettings rejects branch %s', async (_, badBranch) => {
    const result = await saveGitSettings(TEST_DIR, {
      remoteUrl: 'https://github.com/user/repo.git',
      branch: badBranch,
      sshKeyPath: '',
    });

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_BRANCH_NAME');
  });

  it.each([['main'], ['feature/chapter-2'], ['release-2.0'], ['v3.1_hotfix']])(
    'saveGitSettings still validates legitimate branch %s against the remote',
    async (branch) => {
      execFileSync.mockImplementation((cmd) => {
        if (cmd === 'git') return 'git version 2.42.0';
        throw new Error('unexpected command');
      });
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (cmd === 'git' && args[0] === 'ls-remote') cb(null, 'abc\trefs/heads/main\n', '');
        else cb(new Error('unexpected command'));
      });

      const result = await saveGitSettings(TEST_DIR, {
        remoteUrl: 'https://github.com/user/repo.git',
        branch,
        sshKeyPath: '',
      });

      expect(result.status).toBe('ok');
    }
  );

  it('loadGitConfig refuses hostile values read from a shared novel config file', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, 'meta', 'config.yml'),
      'git:\n  remoteUrl: ext::sh -c touch /tmp/pwned\n  branch: --upload-pack=x\n',
      'utf-8'
    );

    const result = loadGitConfig(TEST_DIR);

    expect(result.status).toBe('error');
    expect(['UNSAFE_REMOTE_URL', 'INVALID_BRANCH_NAME']).toContain(result.error.code);
  });
});