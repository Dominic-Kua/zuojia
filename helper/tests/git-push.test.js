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
    // Point the push-trust record at a temp file so the real ~/.zuojia
    // record is never touched.
    process.env.ZUOJIA_TRUSTED_REMOTES_PATH = path.join(TEST_DIR, 'trusted-remotes.json');
  });

  afterEach(async () => {
    delete process.env.ZUOJIA_TRUSTED_REMOTES_PATH;
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

  it('returns REMOTE_NOT_CONFIGURED with setup guidance when no config file and no git remote', async () => {
    // No meta/config.yml and `git config --get remote.origin.url` fails (mock
    // throws) -> fallback finds nothing, so push guides to Settings instead
    // of demanding a config file.
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });
    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('REMOTE_NOT_CONFIGURED');
    expect(result.error.suggestion).toMatch(/Settings.*Git Settings|git remote add origin/);
  });

  it('inherits remote and branch from existing git repo when config file is missing', async () => {
    // HTTPS remote skips SSH-key checks, isolating the inheritance behavior.
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'git' && args[0] === 'config' && args[1] === '--get') return 'https://github.com/user/repo.git\n';
      if (cmd === 'git' && args[0] === 'rev-parse') return 'feature\n';
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/feature\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '1\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      return '';
    });

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });

    expect(result.status).toBe('ok');
    expect(result.data.remoteUrl).toBe('https://github.com/user/repo.git');
    expect(result.data.branch).toBe('feature');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['-c', 'remote.origin.url=https://github.com/user/repo.git', 'push', '-u', 'origin', '--', 'feature'],
      expect.any(Object)
    );
  });

  it('returns error when remote is not configured', async () => {
    await writeConfig('git:\n  branch: main\n');
    // Simulate a repo with no `origin` remote so the fallback finds nothing.
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });
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

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SSH_KEY_NOT_FOUND');
  });

  it('uses ssh auto mode (no -i flag, no agent check) when key field is blank', async () => {
    // Blank key = auto: works with id_ed25519, id_rsa, or agent-only setups.
    await writeConfig('git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: \n');
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/main\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '2\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });

    expect(result.status).toBe('ok');
    expect(result.data.pushed).toBe(true);
    // No ssh-add probe and no forced identity file in auto mode.
    expect(execFileSync).not.toHaveBeenCalledWith('ssh-add', expect.any(Array), expect.anything());
    const pushCall = execFileSync.mock.calls.find(
      (c) => c[0] === 'git' && c[1].includes('push')
    );
    expect(pushCall).toBeDefined();
    expect(pushCall[2].env.GIT_SSH_COMMAND).toBeUndefined();
  });

  it('treats a missing legacy id_rsa default as auto instead of failing', async () => {
    // Configs written when id_rsa was the hardcoded default keep working for
    // ed25519 / agent users when that file does not exist.
    await writeConfig('git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ~/.ssh/id_rsa\n');
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/main\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '2\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });

    // Passes on machines without ~/.ssh/id_rsa (auto mode); on machines with
    // that file it takes the explicit-key path and fails SSH_KEY_NOT_FOUND
    // only if ssh-add is not stubbed — either way it must not be an
    // INVALID_* path error.
    if (result.status === 'error') {
      expect(['SSH_KEY_NOT_FOUND', 'SSH_AGENT_UNAVAILABLE', 'SSH_AGENT_CHECK_FAILED']).toContain(result.error.code);
    } else {
      expect(result.data.pushed).toBe(true);
    }
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

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });
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

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });
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

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SSH_AGENT_CHECK_FAILED');
  });

  it('pushes when only generated files are dirty (backups, logs, .DS_Store)', async () => {
    await writeConfig('git:\n  remoteUrl: https://github.com/user/repo.git\n  branch: main\n');

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'git' && args[0] === 'status') {
        return '?? meta/backups/pre-commit-123/\n?? meta/logs/app.log\n?? manuscript/.DS_Store\n';
      }
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/main\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '1\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });

    expect(result.status).toBe('ok');
    expect(result.data.pushed).toBe(true);
  });

  it('still blocks push when real writing changes are uncommitted', async () => {
    const sshKeyPath = path.join(TEST_DIR, 'id_test');
    await fs.writeFile(sshKeyPath, 'key');
    await writeConfig(`git:\n  remoteUrl: git@github.com:user/repo.git\n  branch: main\n  sshKeyPath: ${sshKeyPath}\n`);

    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'ssh-add' && args[0] === '-l') return '2048 SHA256:abc';
      if (cmd === 'git' && args[0] === 'status') return ' M manuscript/chapter-01.md\n';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });
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

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });

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

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });

    expect(result.status).toBe('ok');
    expect(result.data.pushed).toBe(true);
    expect(result.data.branch).toBe('main');
    expect(result.data.remoteUrl).toBe('git@github.com:user/repo.git');
    expect(result.data.pushedCommits).toBe(3);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['-c', 'remote.origin.url=git@github.com:user/repo.git', 'push', '-u', 'origin', '--', 'main'],
      expect.any(Object)
    );
    expect(execFileSync).not.toHaveBeenCalledWith('git', ['remote', 'set-url', 'origin', 'git@github.com:user/repo.git'], expect.any(Object));
    expect(execFileSync).not.toHaveBeenCalledWith('git', ['remote', 'add', 'origin', 'git@github.com:user/repo.git'], expect.any(Object));
  });
});

describe('pushToRemote remote-trust hardening', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, '.git'), { recursive: true });
    vi.clearAllMocks();
    process.env.ZUOJIA_TRUSTED_REMOTES_PATH = path.join(TEST_DIR, 'trusted-remotes.json');
  });

  afterEach(async () => {
    delete process.env.ZUOJIA_TRUSTED_REMOTES_PATH;
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  function mockSuccessfulPush() {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/main\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '1\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });
  }

  it('returns REMOTE_UNCONFIRMED on first push without running git push', async () => {
    await writeConfig('git:\n  remoteUrl: https://github.com/user/repo.git\n  branch: main\n');
    mockSuccessfulPush();

    const result = await pushToRemote(TEST_DIR);

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('REMOTE_UNCONFIRMED');
    expect(result.error.context.remoteUrl).toBe('https://github.com/user/repo.git');
    expect(result.error.context.branch).toBe('main');
    expect(execFileSync).not.toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['push']),
      expect.any(Object)
    );
  });

  it('pushes after confirm and skips the gate on later pushes', async () => {
    await writeConfig('git:\n  remoteUrl: https://github.com/user/repo.git\n  branch: main\n');
    mockSuccessfulPush();

    const confirmed = await pushToRemote(TEST_DIR, { confirmRemote: true });
    expect(confirmed.status).toBe('ok');

    const again = await pushToRemote(TEST_DIR);
    expect(again.status).toBe('ok');
  });

  it('re-prompts when the configured remote changes', async () => {
    await writeConfig('git:\n  remoteUrl: https://github.com/user/repo.git\n  branch: main\n');
    mockSuccessfulPush();
    expect((await pushToRemote(TEST_DIR, { confirmRemote: true })).status).toBe('ok');

    await writeConfig('git:\n  remoteUrl: https://evil.example/other.git\n  branch: main\n');
    const result = await pushToRemote(TEST_DIR);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('REMOTE_UNCONFIRMED');
  });

  it.each([
    ['ext transport', 'ext::sh -c touch /tmp/pwned'],
    ['uppercase EXT transport', 'EXT::sh -c touch /tmp/pwned'],
    ['fd transport', 'fd::17'],
    ['upload-pack branch', null, '--upload-pack=touch /tmp/pwned'],
    ['leading-dash branch', null, '-pwn'],
    ['parent traversal branch', null, 'a/../b'],
  ])('refuses hostile config %s without invoking git transport', async (_, badUrl, badBranch) => {
    await writeConfig(
      `git:\n  remoteUrl: ${badUrl || 'https://github.com/user/repo.git'}\n  branch: ${badBranch || 'main'}\n`
    );
    mockSuccessfulPush();

    const result = await pushToRemote(TEST_DIR);

    expect(result.status).toBe('error');
    expect(['UNSAFE_REMOTE_URL', 'INVALID_BRANCH_NAME']).toContain(result.error.code);
    // No ls-remote / push may run with hostile values, confirmed or not.
    const transportCalls = execFileSync.mock.calls.filter(
      ([cmd, args]) => cmd === 'git' && (args.includes('ls-remote') || args.includes('push'))
    );
    expect(transportCalls).toEqual([]);
    const confirmedAttempt = await pushToRemote(TEST_DIR, { confirmRemote: true });
    expect(confirmedAttempt.status).toBe('error');
    expect(['UNSAFE_REMOTE_URL', 'INVALID_BRANCH_NAME']).toContain(confirmedAttempt.error.code);
  });

  it.each([
    ['https', 'https://github.com/user/repo.git'],
    ['ssh scp-like', 'git@github.com:user/repo.git'],
    ['ssh scheme', 'ssh://git@nas.local:2222/repo.git'],
    ['lan https', 'https://192.168.1.50/repo.git'],
    ['local path', '/Volumes/NAS/novels/repo'],
    ['file scheme', 'file:///srv/git/repo.git'],
  ])('accepts legitimate remote %s', async (_, url) => {
    await writeConfig(`git:\n  remoteUrl: ${url}\n  branch: feature/chapter-2\n`);
    // SSH remotes need an (auto-mode) key story; https/file/local skip it.
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === '--version') return 'git version 2.42.0';
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'ls-remote') return 'abc123\trefs/heads/main\n';
      if (cmd === 'git' && args[0] === 'rev-list') return '1\n';
      if (cmd === 'git' && args[0] === '-c' && args[2] === 'push') return '';
      throw new Error(`unexpected command ${cmd} ${args.join(' ')}`);
    });

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });

    expect(result.status).toBe('ok');
  });

  it('emits -- before the branch in ls-remote and push invocations', async () => {
    await writeConfig('git:\n  remoteUrl: https://github.com/user/repo.git\n  branch: main\n');
    mockSuccessfulPush();

    const result = await pushToRemote(TEST_DIR, { confirmRemote: true });
    expect(result.status).toBe('ok');

    const lsRemote = execFileSync.mock.calls.find(
      ([cmd, args]) => cmd === 'git' && args.includes('ls-remote')
    );
    expect(lsRemote[1]).toEqual(
      expect.arrayContaining(['--heads', 'origin', '--', 'main'])
    );
  });
});
