// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';

vi.mock('../../helper/src/util/error.js', () => ({
  createError: vi.fn((code, message) => ({
    status: 'error',
    error: { code, message, suggestion: null, context: null },
    timestamp: new Date().toISOString(),
  })),
}));

describe('validateNovel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for non-existent novel path', async () => {
    const { validateNovel } = await import('../../helper/src/index/validate.js');
    const result = await validateNovel('/tmp/nonexistent-novel');
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('ENOENT');
  });

  it('returns error when required directory missing', async () => {
    const { validateNovel } = await import('../../helper/src/index/validate.js');
    const mockDir = '/tmp/test-novel-validate';
    // Only create manuscript, skip wiki and meta
    fs.mkdirSync(path.join(mockDir, 'manuscript'), { recursive: true });
    try {
      const result = await validateNovel(mockDir);
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('INVALID_MANIFEST');
    } finally {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
  });

  it('returns error when meta/index.json missing', async () => {
    const { validateNovel } = await import('../../helper/src/index/validate.js');
    const mockDir = '/tmp/test-novel-validate';
    fs.mkdirSync(path.join(mockDir, 'manuscript'), { recursive: true });
    fs.mkdirSync(path.join(mockDir, 'wiki'), { recursive: true });
    fs.mkdirSync(path.join(mockDir, 'meta'), { recursive: true });
    try {
      const result = await validateNovel(mockDir);
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('INVALID_MANIFEST');
    } finally {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
  });

  it('returns ok for valid novel structure', async () => {
    const { validateNovel } = await import('../../helper/src/index/validate.js');
    const mockDir = '/tmp/test-novel-validate';
    fs.mkdirSync(path.join(mockDir, 'manuscript'), { recursive: true });
    fs.mkdirSync(path.join(mockDir, 'wiki'), { recursive: true });
    fs.mkdirSync(path.join(mockDir, 'meta'), { recursive: true });
    fs.writeFileSync(path.join(mockDir, 'meta', 'index.json'), '{}');
    try {
      const result = await validateNovel(mockDir);
      expect(result.status).toBe('ok');
      expect(result.data.isValid).toBe(true);
    } finally {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
  });
});

describe('createNovel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for empty novel name', async () => {
    const { createNovel } = await import('../../helper/src/index/create.js');
    const result = await createNovel('', '/tmp/test-create');
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_NOVEL_NAME');
  });

  it('returns error for whitespace-only name', async () => {
    const { createNovel } = await import('../../helper/src/index/create.js');
    const result = await createNovel('   ', '/tmp/test-create');
    expect(result.status).toBe('error');
  });

  it('returns error for names with path separators', async () => {
    const { createNovel } = await import('../../helper/src/index/create.js');
    const result = await createNovel('../evil', '/tmp/test-create');
    expect(result.status).toBe('error');
  });

  it('creates novel directory structure', async () => {
    const { createNovel } = await import('../../helper/src/index/create.js');
    const rootDir = '/tmp/test-create-novel';
    const result = await createNovel('My Test Novel', rootDir);
    expect(result.status).toBe('ok');
    expect(result.data.novelPath).toContain('my-test-novel');
    // Verify structure was created
    const novelPath = result.data.novelPath;
    expect(fs.existsSync(path.join(novelPath, 'manuscript'))).toBe(true);
    expect(fs.existsSync(path.join(novelPath, 'wiki'))).toBe(true);
    expect(fs.existsSync(path.join(novelPath, 'meta'))).toBe(true);
    expect(fs.existsSync(path.join(novelPath, 'meta', 'index.json'))).toBe(true);
    // Cleanup
    fs.rmSync(novelPath, { recursive: true, force: true });
  });

  it('returns error when novel already exists', async () => {
    const { createNovel } = await import('../../helper/src/index/create.js');
    const rootDir = '/tmp/test-create-exists';
    const slug = 'existing-novel';
    fs.mkdirSync(path.join(rootDir, slug), { recursive: true });
    try {
      const result = await createNovel('Existing Novel', rootDir);
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NOVEL_EXISTS');
    } finally {
      fs.rmSync(path.join(rootDir, slug), { recursive: true, force: true });
    }
  });

  it('handles special characters in name', async () => {
    const { createNovel } = await import('../../helper/src/index/create.js');
    const rootDir = '/tmp/test-create-special';
    const result = await createNovel('Novel - With Spaces & More!', rootDir);
    expect(result.status).toBe('ok');
    expect(result.data.novelPath).toContain('novel---with-spaces--more');
    // Cleanup
    if (result.status === 'ok') {
      fs.rmSync(result.data.novelPath, { recursive: true, force: true });
    }
  });
});
