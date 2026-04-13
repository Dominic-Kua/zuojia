import path from 'path';
import os from 'os';

export function expandHome(filePath) {
  if (!filePath) {
    return filePath;
  }

  const home = os.homedir();
  if (!home) {
    return filePath;
  }

  if (filePath === '~') {
    return home;
  }

  if (filePath.startsWith('~/')) {
    return path.join(home, filePath.slice(2));
  }

  return filePath;
}