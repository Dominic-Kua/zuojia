import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { createError } from '../util/error.js';

export async function getExportLogs(novelPath, limit = 10) {
  try {
    if (!novelPath || !fs.existsSync(novelPath)) {
      return createError('INVALID_NOVEL_PATH', 'Novel path does not exist');
    }

    const logsDir = path.join(novelPath, 'meta', 'logs');

    if (!fs.existsSync(logsDir)) {
      return { status: 'ok', data: [], timestamp: new Date().toISOString() };
    }

    const files = await fsPromises.readdir(logsDir);
    const logFiles = files
      .filter((f) => f.startsWith('export-') && f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, limit);

    const entries = await Promise.all(
      logFiles.map(async (filename) => {
        const content = await fsPromises.readFile(path.join(logsDir, filename), 'utf-8');
        return { filename, content };
      })
    );

    return { status: 'ok', data: entries, timestamp: new Date().toISOString() };
  } catch (error) {
    return createError('GET_EXPORT_LOGS_FAILED', 'Failed to read export logs', null, {
      error: error.message,
    });
  }
}
