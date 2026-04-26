import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getExportLogs } from '../src/export/logs.js';

const TEST_DIR = path.join(process.cwd(), `test-export-logs-${Date.now()}`);

async function makeLogsDir() {
  await fs.mkdir(path.join(TEST_DIR, 'meta', 'logs'), { recursive: true });
}

describe('getExportLogs', () => {
  beforeEach(makeLogsDir);

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns an empty array when no log files exist', async () => {
    const result = await getExportLogs(TEST_DIR);
    expect(result.status).toBe('ok');
    expect(result.data).toEqual([]);
  });

  it('returns log entries sorted newest-first with filename and content', async () => {
    const logsDir = path.join(TEST_DIR, 'meta', 'logs');
    await fs.writeFile(path.join(logsDir, 'export-2026-01-01T00-00-00-000Z.log'), 'old log', 'utf-8');
    await fs.writeFile(path.join(logsDir, 'export-2026-04-18T12-00-00-000Z.log'), 'new log', 'utf-8');

    const result = await getExportLogs(TEST_DIR);
    expect(result.status).toBe('ok');
    expect(result.data).toHaveLength(2);
    // Newest first
    expect(result.data[0].filename).toBe('export-2026-04-18T12-00-00-000Z.log');
    expect(result.data[0].content).toBe('new log');
    expect(result.data[1].filename).toBe('export-2026-01-01T00-00-00-000Z.log');
    expect(result.data[1].content).toBe('old log');
  });

  it('honours the limit parameter', async () => {
    const logsDir = path.join(TEST_DIR, 'meta', 'logs');
    for (let i = 1; i <= 10; i++) {
      const ts = `2026-01-${String(i).padStart(2, '0')}T00-00-00-000Z`;
      await fs.writeFile(path.join(logsDir, `export-${ts}.log`), `log ${i}`, 'utf-8');
    }

    const result = await getExportLogs(TEST_DIR, 3);
    expect(result.status).toBe('ok');
    expect(result.data).toHaveLength(3);
  });

  it('ignores non-export log files in the logs directory', async () => {
    const logsDir = path.join(TEST_DIR, 'meta', 'logs');
    await fs.writeFile(path.join(logsDir, 'export-2026-04-18T12-00-00-000Z.log'), 'export', 'utf-8');
    await fs.writeFile(path.join(logsDir, 'git-push-2026-04-18.log'), 'git', 'utf-8');
    await fs.writeFile(path.join(logsDir, 'other.txt'), 'misc', 'utf-8');

    const result = await getExportLogs(TEST_DIR);
    expect(result.status).toBe('ok');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].filename).toContain('export-');
  });

  it('returns error when novelPath does not exist', async () => {
    const result = await getExportLogs('/nonexistent/path');
    expect(result.status).toBe('error');
  });
});
