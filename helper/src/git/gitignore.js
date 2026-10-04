import fs from 'fs';
import path from 'path';

export const NOVEL_GITIGNORE_LINES = [
  '# zuojia: generated files that are never committed',
  'meta/backups/',
  'meta/exports/',
  'meta/logs/',
  '.DS_Store',
];

/**
 * Write a .gitignore for a newly initialized novel repo so app-generated
 * files (snapshots, exports, logs) never dirty the working tree.
 * Only creates the file when missing; existing user files are never touched.
 * Best-effort: a missing gitignore must never block commits.
 */
export function ensureNovelGitignore(novelPath) {
  try {
    const gitignorePath = path.join(novelPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, `${NOVEL_GITIGNORE_LINES.join('\n')}\n`, 'utf-8');
    }
  } catch {
    // Ignore: gitignore is a convenience, not a requirement.
  }

  return null;
}
