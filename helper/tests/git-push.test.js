import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { execFileSync } from 'child_process';
import { pushToRemote } from '../src/git/push.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
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
        throw new Error('Could not open a connection to your authentication agent.');
      }
      throw new Error('unexpected command');
    });

    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SSH_AGENT_UNAVAILABLE');
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
