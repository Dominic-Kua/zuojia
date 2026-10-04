import fs from 'fs';
import os from 'os';
import path from 'path';

// Trust-on-first-use record for push remotes. meta/config.yml travels with
// shared/cloned novels, so the remote it names is untrusted until the user
// confirms it. Confirmations live OUTSIDE the novel (app-level file), keyed
// by the resolved novel path, so novel content can neither pre-confirm nor
// read them.
function defaultStorePath() {
  // Test hook: integration/unit tests point this at a temp file so the real
  // ~/.zuojia record is never touched. Never set this in production code.
  if (process.env.ZUOJIA_TRUSTED_REMOTES_PATH) {
    return process.env.ZUOJIA_TRUSTED_REMOTES_PATH;
  }
  return path.join(os.homedir(), '.zuojia', 'trusted-remotes.json');
}

function readStore(storePath) {
  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(storePath, record) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(record, null, 2));
}

function novelKey(novelPath) {
  try {
    return fs.realpathSync(novelPath);
  } catch {
    return path.resolve(novelPath);
  }
}

export function getConfirmedRemote(novelPath, storePath = defaultStorePath()) {
  const record = readStore(storePath);
  return record[novelKey(novelPath)] || null;
}

export function confirmRemote(novelPath, remoteUrl, branch, storePath = defaultStorePath()) {
  const record = readStore(storePath);
  record[novelKey(novelPath)] = {
    remoteUrl,
    branch,
    confirmedAt: new Date().toISOString(),
  };
  writeStore(storePath, record);
}

export function isRemoteConfirmed(novelPath, remoteUrl, storePath = defaultStorePath()) {
  const confirmed = getConfirmedRemote(novelPath, storePath);
  return !!confirmed && confirmed.remoteUrl === remoteUrl;
}
