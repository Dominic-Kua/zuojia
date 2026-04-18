import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { execFileSync, execFile } from 'child_process';
import { pushToRemote } from '../src/git/push.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

const TEST_DIR = path.join(process.cwd(), 'test-push-' + Date.now());

async function writeConfig(content) {
  const metaDir = path.join(TEST_DIR, 'meta');
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(path.join(metaDir, 'config.yml'), content, 'utf-8');
}

describe('pushToRemote', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, '.git'), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns error for invalid novel path', async () => {
    const result = await pushToRemote('/nope');
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });

  it('returns error when working directory has no git repository', async () => {
    await fs.rm(path.join(TEST_DIR, '.git'), { recursive: true, force: true });
    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('GIT_REPO_NOT_FOUND');
  });

  it('returns error when git config file is missing', async () => {
    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('GIT_CONFIG_MISSING');
  });

  it('returns error when remote is not configured', async () => {
    await writeConfig('git:\n  branch: main\n');
    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('REMOTE_NOT_CONFIGURED');
  });

  it('returns error when ssh key path is missing on disk', async () => {
    await writeConfig('git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ~/.ssh/id_fake\n');
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'ssh-add' && args[0] === '-l') return '2048 SHA256:abc';
      throw new Error('unexpected command');
    });

    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SSH_KEY_NOT_FOUND');
  });

  it('returns error when ssh agent is unavailable', async () => {
    await writeConfig('git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ~/.ssh/id_test\n');
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'ssh-add' && args[0] === '-l') {
        const err = new Error('Could not open a connection to your authentication agent.');
        err.status = 2;
        throw err;
      }
      throw new Error('unexpected command');
    });

    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SSH_AGENT_UNAVAILABLE');
  });

  it('returns error when ssh agent has no identities loaded', async () => {
    await writeConfig('git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ~/.ssh/id_test\n');
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'ssh-add' && args[0] === '-l') {
        const err = new Error('The agent has no identities.');
        err.status = 1;
        throw err;
      }
      throw new Error('unexpected command');
    });

    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SSH_AGENT_NO_IDENTITIES');
  });

  it('returns SSH_AGENT_CHECK_FAILED when ssh-add exits with unexpected error', async () => {
    await writeConfig('git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ~/.ssh/id_test\n');
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'ssh-add' && args[0] === '-l') {
        throw new Error('Unexpected failure');
      }
      throw new Error('unexpected command');
    });

    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SSH_AGENT_CHECK_FAILED');
  });

  it('returns error when working tree has uncommitted changes', async () => {
    const sshKeyPath = path.join(TEST_DIR, 'id_test');
    await fs.writeFile(sshKeyPath, 'key');
    await writeConfig(`git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ${sshKeyPath}\n`);

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'ssh-add' && args[0] === '-l') return '2048 SHA256:abc';
      if (cmd === 'git' && args[0] === 'status') return ' M manuscript/chapter-01.md\n';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('WORKING_TREE_DIRTY');
  });

  it.each([
    ['double quote', '/home/user/.ssh/id_rsa"; echo pwned'],
    ['single quote', "/home/user/.ssh/id_rsa'; echo pwned"],
    ['backslash', '/home/user/.ssh/id_rsa\\evil'],
    ['backtick', '/home/user/.ssh/id_rsa`echo pwned`'],
    ['dollar sign', '/home/user/.ssh/id_rsa$HOME'],
    ['semicolon', '/home/user/.ssh/id_rsa;echo pwned'],
    ['pipe', '/home/user/.ssh/id_rsa|echo pwned'],
    ['ampersand', '/home/user/.ssh/id_rsa&echo pwned'],
    ['spaces', '/home/user/.ssh/id rsa'],
    // Note: newlines cannot be injected via the YAML config file (the parser
    // treats them as line terminators), but validateSshKeyPath still rejects
    // them for defense-in-depth.
  ])('returns INVALID_SSH_KEY_PATH for path containing %s', async (_, badPath) => {
    const metaDir = path.join(TEST_DIR, 'meta');
    await fs.mkdir(metaDir, { recursive: true });
    await fs.writeFile(
      path.join(metaDir, 'config.yml'),
      `git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ${badPath}\n`,
      'utf-8'
    );
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      throw new Error('unexpected command');
    });

    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_SSH_KEY_PATH');
  });

  it('skips SSH checks and does not set GIT_SSH_COMMAND for HTTPS remote', async () => {
    await writeConfig('git:\n  remoteUrl: https://github.com/user/repo.git\n  branch: main\n');

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/main\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '2\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      return '';
    });

    const result = await pushToRemote(TEST_DIR);

    expect(result.status).toBe('ok');
    expect(result.data.remoteUrl).toBe('https://github.com/user/repo.git');
    // ssh-add must never be called for HTTPS remotes
    expect(execFileSync).not.toHaveBeenCalledWith('ssh-add', expect.any(Array), expect.anything());
    // GIT_SSH_COMMAND must not be set in the push call
    const pushCall = execFileSync.mock.calls.find(
      (c) => c[0] === 'git' && c[1].includes('push')
    );
    expect(pushCall).toBeDefined();
    expect(pushCall[2].env.GIT_SSH_COMMAND).toBeUndefined();
  });

  it('pushes commits to configured branch and returns pushed commit count', async () => {
    const sshKeyPath = path.join(TEST_DIR, 'id_test');
    await fs.writeFile(sshKeyPath, 'key');
    await writeConfig(`git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ${sshKeyPath}\n`);

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'ssh-add' && args[0] === '-l') return '2048 SHA256:abc';
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/main\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '3\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      return '';
    });

    const result = await pushToRemote(TEST_DIR);

    expect(result.status).toBe('ok');
    expect(result.data.pushed).toBe(true);
    expect(result.data.branch).toBe('main');
    expect(result.data.remoteUrl).toBe('git@github.com:user/repo.git');
    expect(result.data.pushedCommits).toBe(3);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['-c', 'remote.origin.url=git@github.com:user/repo.git', 'push', 'origin', 'main'],
      expect.any(Object)
    );
    expect(execFileSync).not.toHaveBeenCalledWith('git', ['remote', 'set-url', 'origin', 'git@github.com:user/repo.git'], expect.any(Object));
    expect(execFileSync).not.toHaveBeenCalledWith('git', ['remote', 'add', 'origin', 'git@github.com:user/repo.git'], expect.any(Object));
  });
});
