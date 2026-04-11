import path from 'path';

export function expandHome(filePath) {
  if (!filePath) {
    return filePath;
  }

  if (filePath === '~') {
    return process.env.HOME || filePath;
  }

  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME || '', filePath.slice(2));
  }

  return filePath;
}