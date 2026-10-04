/**
 * Wiki image-embed asset paths.
 *
 * Wiki files are untrusted input the moment novels are shared: a
 * collaborator's `![[../../../../.ssh/id_rsa]]` must never resolve outside
 * the novel's `wiki/` directory. Browsers normalize `..` in `file://` URLs,
 * so the segments are validated here, before any URL is built.
 */

/**
 * Validate a wiki embed filename.
 *
 * Returns `{ remote: true, url }` for http(s) embeds (passed through;
 * rendered with `referrerpolicy="no-referrer"`), `{ remote: false, path }`
 * with a normalized `/`-joined, per-segment-encoded relative path, or
 * `null` when the value must not become an image at all (traversal,
 * absolute paths, empty values).
 */
export function sanitizeWikiAssetPath(fileName) {
  const trimmed = String(fileName || '').trim();
  if (!trimmed) {
    return null;
  }

  // Remote embeds pass through unchanged (existing policy: allowed).
  if (/^(https?:)?\/\//i.test(trimmed)) {
    return { remote: true, url: trimmed };
  }

  // Decode repeatedly to catch %2e%2e and double-encoded traversals.
  let decoded = trimmed;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      break;
    }
  }

  const segments = decoded.replace(/\\/g, '/').split('/');
  const clean = [];
  for (const seg of segments) {
    // Empty covers absolute paths (`/etc/x`), `//`, and trailing slashes;
    // `.`/`..` cover traversal in any slash flavor; null bytes are never
    // valid in a filename.
    if (!seg || seg === '.' || seg === '..' || seg.includes('\0')) {
      return null;
    }
    // encodeURIComponent escapes `:?#` etc. per segment, so no query,
    // fragment, or scheme smuggling survives.
    clean.push(encodeURIComponent(seg));
  }
  if (clean.length === 0) {
    return null;
  }
  return { remote: false, path: clean.join('/') };
}

/**
 * Build the `file://` URL for a validated wiki embed, or `''` when the
 * filename is refused. Remote embeds are returned unchanged.
 */
export function buildWikiAssetUrl(novelPath, fileName) {
  if (!novelPath) {
    return '';
  }
  const sane = sanitizeWikiAssetPath(fileName);
  if (!sane) {
    return '';
  }
  if (sane.remote) {
    return sane.url;
  }
  const base = String(novelPath).replace(/\\/g, '/');
  return `file://${base}/wiki/${sane.path}`;
}
