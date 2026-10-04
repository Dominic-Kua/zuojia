import fs from 'fs';
import path from 'path';

/**
 * Symlink-aware path containment for novel content.
 *
 * Lexical checks (`..` rejection, `path.relative`) are defeated by symlink
 * components: `manuscript/evil` may itself be a link to `/etc`, and a
 * cloned/shared novel can carry such links (git preserves symlinks). Every
 * function here resolves through symlinks before judging containment.
 */

export function realpathOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

export function isWithinDir(rootReal, candidateReal) {
  if (!rootReal || !candidateReal) {
    return false;
  }
  const rel = path.relative(rootReal, candidateReal);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolve `segments` under `rootDir`, following symlinks, and require the
 * final location to stay inside the resolved root.
 *
 * Returns the usable path, or `null` when anything escapes, is missing, or
 * looks wrong. Handles not-yet-existing targets (fresh writes) by resolving
 * the nearest existing ancestor; an explicitly symlinked final component is
 * always rejected (otherwise a write would follow it outside the root).
 */
export function resolveContainedPath(rootDir, ...segments) {
  const rootReal = realpathOrNull(rootDir);
  if (!rootReal) {
    return null;
  }
  const lexical = path.resolve(rootDir, ...segments);

  // A symlinked final component (even a dangling one) would be followed by
  // a later read/write — reject it outright. Missing paths throw here, which
  // is the normal fresh-write case.
  try {
    if (fs.lstatSync(lexical).isSymbolicLink()) {
      return null;
    }
  } catch {
    // Not present (yet) — continue with ancestor resolution.
  }

  // Walk up to the nearest existing ancestor so fresh-write targets resolve.
  let ancestor = lexical;
  const rest = [];
  for (;;) {
    if (fs.existsSync(ancestor)) {
      break;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) {
      return null;
    }
    rest.unshift(path.basename(ancestor));
    ancestor = parent;
  }
  const ancestorReal = realpathOrNull(ancestor);
  if (!ancestorReal) {
    return null;
  }
  const candidateReal = path.join(ancestorReal, ...rest);
  // Resolve the final location too (covers symlink chains in the middle);
  // fall back to the joined path when it does not exist yet.
  const finalReal = realpathOrNull(candidateReal) || candidateReal;
  if (!isWithinDir(rootReal, finalReal)) {
    return null;
  }
  return candidateReal;
}

/**
 * True when `p` exists and is a symlink. Directory scanners use this to
 * skip symlinked entries instead of following them into snapshots, word
 * counts, indexes, and search results.
 */
export function isSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
