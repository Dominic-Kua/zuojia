import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { createSnapshot, listSnapshots, deleteSnapshot } from '../../src/backup/snapshot.js';

describe('createSnapshot', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-novel-snapshot-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create novel structure
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
    
    // Create some test files
    await fs.writeFile(path.join(testDir, 'manuscript', 'chapter-01.md'), '# Chapter 1\n\nTest content');
    await fs.writeFile(path.join(testDir, 'wiki', 'alice.md'), '# Alice\n\nCharacter notes');
    await fs.writeFile(path.join(testDir, 'meta', 'index.json'), '{}');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('creates a snapshot with a label', async () => {
    const result = await createSnapshot(testDir, 'End of Chapter 5');
    
    expect(result.status).toBe('ok');
    expect(result.data).toBeDefined();
    expect(result.data.label).toBe('End of Chapter 5');
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.path).toContain('meta/backups');
    expect(result.data.size).toBeGreaterThan(0);
  });

  it('creates a snapshot without a label', async () => {
    const result = await createSnapshot(testDir);
    
    expect(result.status).toBe('ok');
    expect(result.data.label).toBeNull();
    expect(result.data.timestamp).toBeDefined();
  });

  it('copies all manuscript files to backup', async () => {
    const result = await createSnapshot(testDir, 'test');
    
    const backupPath = result.data.path;
    const chapterPath = path.join(backupPath, 'manuscript', 'chapter-01.md');
    const content = await fs.readFile(chapterPath, 'utf-8');
    
    expect(content).toContain('Test content');
  });

  it('copies all wiki files to backup', async () => {
    const result = await createSnapshot(testDir, 'test');
    
    const backupPath = result.data.path;
    const wikiPath = path.join(backupPath, 'wiki', 'alice.md');
    const content = await fs.readFile(wikiPath, 'utf-8');
    
    expect(content).toContain('Character notes');
  });

  it('copies meta files to backup', async () => {
    const result = await createSnapshot(testDir, 'test');
    
    const backupPath = result.data.path;
    const metaPath = path.join(backupPath, 'meta', 'index.json');
    const exists = await fs.access(metaPath).then(() => true).catch(() => false);
    
    expect(exists).toBe(true);
  });

  it('creates unique backup directories for multiple snapshots', async () => {
    const result1 = await createSnapshot(testDir, 'first');
    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    const result2 = await createSnapshot(testDir, 'second');
    
    expect(result1.data.path).not.toBe(result2.data.path);
  });

  it('handles invalid novel path', async () => {
    const result = await createSnapshot('/nonexistent/path', 'test');
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });

  it('includes snapshot metadata in manifest', async () => {
    const result = await createSnapshot(testDir, 'test snapshot');
    
    const backupPath = result.data.path;
    const manifestPath = path.join(backupPath, 'snapshot-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    
    expect(manifest.timestamp).toBeDefined();
    expect(manifest.label).toBe('test snapshot');
    expect(manifest.novelPath).toBe(testDir);
    expect(manifest.files).toBeGreaterThan(0);
  });

  it('sanitizes label for directory name', async () => {
    const result = await createSnapshot(testDir, 'Test/Snapshot: With Special-Chars');
    
    // Extract just the backup directory name (last part of path)
    const backupDirName = result.data.path.split('/').pop();
    
    // The sanitized label part should not contain forward slashes or colons
    expect(backupDirName).not.toContain(':');
    // Forward slashes should be replaced with dashes
    expect(backupDirName).toContain('Test-Snapshot');
    expect(backupDirName).toContain('Special-Chars');
  });
});

describe('listSnapshots', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-novel-list-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore
    }
  });

  it('returns empty list when no snapshots exist', async () => {
    const result = await listSnapshots(testDir);
    
    expect(result.status).toBe('ok');
    expect(result.data.snapshots).toEqual([]);
  });

  it('lists all snapshots with metadata', async () => {
    await createSnapshot(testDir, 'first');
    await new Promise(resolve => setTimeout(resolve, 10));
    await createSnapshot(testDir, 'second');
    
    const result = await listSnapshots(testDir);
    
    expect(result.status).toBe('ok');
    expect(result.data.snapshots).toHaveLength(2);
    expect(result.data.snapshots[0].label).toBeDefined();
    expect(result.data.snapshots[0].timestamp).toBeDefined();
    expect(result.data.snapshots[0].size).toBeGreaterThan(0);
  });

  it('sorts snapshots by timestamp descending', async () => {
    await createSnapshot(testDir, 'older');
    await new Promise(resolve => setTimeout(resolve, 10));
    await createSnapshot(testDir, 'newer');
    
    const result = await listSnapshots(testDir);
    
    const timestamps = result.data.snapshots.map(s => s.timestamp);
    expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
  });

  it('handles invalid novel path', async () => {
    const result = await listSnapshots('/nonexistent/path');
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_PATH');
  });
});

describe('deleteSnapshot', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-novel-delete-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore
    }
  });

  it('deletes a snapshot by timestamp', async () => {
    const createResult = await createSnapshot(testDir, 'test');
    const timestamp = createResult.data.timestamp;
    
    const deleteResult = await deleteSnapshot(testDir, timestamp);
    
    expect(deleteResult.status).toBe('ok');
    
    // Verify snapshot is gone
    const listResult = await listSnapshots(testDir);
    expect(listResult.data.snapshots).toHaveLength(0);
  });

  it('handles deleting nonexistent snapshot', async () => {
    const result = await deleteSnapshot(testDir, 99999999);
    
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('SNAPSHOT_NOT_FOUND');
  });
});
