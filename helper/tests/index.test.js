import path from 'path';
import fs from 'fs';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { createNovel, getIndex, validateNovel } from '../src/index/index.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use temp directory for tests
const TEST_HOME = path.join(__dirname, '..', 'tests', 'temp');

describe('Index Operations', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    if (fs.existsSync(TEST_HOME)) {
      await rm(TEST_HOME, { recursive: true, force: true });
    }
    await mkdir(TEST_HOME, { recursive: true });
  });

  afterAll(async () => {
    // Clean up after all tests
    if (fs.existsSync(TEST_HOME)) {
      await rm(TEST_HOME, { recursive: true, force: true });
    }
  });

  describe('createNovel', () => {
    it('should create a new novel with correct directory structure', async () => {
      const novelName = 'test-novel';
      const novelPath = path.join(TEST_HOME, novelName);

      const result = await createNovel(novelName, TEST_HOME);

      // Should return novel path
      expect(result).toEqual({
        status: 'ok',
        data: { novelPath },
        timestamp: expect.any(String),
      });

      // Should create manuscript directory
      expect(fs.existsSync(path.join(novelPath, 'manuscript'))).toBe(true);

      // Should create wiki directory
      expect(fs.existsSync(path.join(novelPath, 'wiki'))).toBe(true);

      // Should create meta directory
      expect(fs.existsSync(path.join(novelPath, 'meta'))).toBe(true);

      // Should create meta/index.json
      expect(fs.existsSync(path.join(novelPath, 'meta', 'index.json'))).toBe(true);

      // Should initialize empty index
      const indexContent = await readFile(path.join(novelPath, 'meta', 'index.json'), 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index).toEqual({
        chapters: [],
        wiki: [],
        lastRebuild: expect.any(String),
      });
    });

    it('should return error if novel name is empty', async () => {
      const result = await createNovel('', TEST_HOME);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('INVALID_NOVEL_NAME');
      expect(result.error.message).toContain('empty');
    });

    it('should return error if novel name contains invalid characters', async () => {
      const invalidNames = ['novel/name', 'novel\\name', 'novel:name'];

      for (const name of invalidNames) {
        const result = await createNovel(name, TEST_HOME);
        expect(result.status).toEqual('error');
        expect(result.error.code).toEqual('INVALID_NOVEL_NAME');
      }
    });

    it('should return error if novel already exists', async () => {
      const novelName = 'existing-novel';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create first novel
      await createNovel(novelName, TEST_HOME);

      // Try creating again
      const result = await createNovel(novelName, TEST_HOME);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('NOVEL_EXISTS');
    });
  });

  describe('getIndex', () => {
    it('should read and return existing index', async () => {
      const novelName = 'test-novel';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create novel first
      await createNovel(novelName, TEST_HOME);

      // Read index
      const result = await getIndex(novelPath);

      expect(result.status).toEqual('ok');
      expect(result.data).toHaveProperty('chapters');
      expect(result.data).toHaveProperty('wiki');
      expect(result.data.chapters).toEqual([]);
      expect(result.data.wiki).toEqual([]);
    });

    it('should return error if index does not exist', async () => {
      const novelPath = path.join(TEST_HOME, 'nonexistent');
      const result = await getIndex(novelPath);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('ENOENT');
    });
  });

  describe('validateNovel', () => {
    it('should validate a properly structured novel directory', async () => {
      const novelName = 'valid-novel';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create a valid novel
      await createNovel(novelName, TEST_HOME);

      const result = await validateNovel(novelPath);

      expect(result).toEqual({
        status: 'ok',
        data: { isValid: true, novelPath },
        timestamp: expect.any(String),
      });
    });

    it('should return error if manuscript directory is missing', async () => {
      const novelPath = path.join(TEST_HOME, 'incomplete-novel');
      await mkdir(novelPath, { recursive: true });
      await mkdir(path.join(novelPath, 'wiki'), { recursive: true });
      await mkdir(path.join(novelPath, 'meta'), { recursive: true });
      await writeFile(path.join(novelPath, 'meta', 'index.json'), JSON.stringify({ chapters: [] }));

      const result = await validateNovel(novelPath);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('INVALID_MANIFEST');
      expect(result.error.message).toContain('manuscript');
    });

    it('should return error if wiki directory is missing', async () => {
      const novelPath = path.join(TEST_HOME, 'incomplete-novel-2');
      await mkdir(novelPath, { recursive: true });
      await mkdir(path.join(novelPath, 'manuscript'), { recursive: true });
      await mkdir(path.join(novelPath, 'meta'), { recursive: true });
      await writeFile(path.join(novelPath, 'meta', 'index.json'), JSON.stringify({ chapters: [] }));

      const result = await validateNovel(novelPath);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('INVALID_MANIFEST');
      expect(result.error.message).toContain('wiki');
    });

    it('should return error if meta directory is missing', async () => {
      const novelPath = path.join(TEST_HOME, 'incomplete-novel-3');
      await mkdir(novelPath, { recursive: true });
      await mkdir(path.join(novelPath, 'manuscript'), { recursive: true });
      await mkdir(path.join(novelPath, 'wiki'), { recursive: true });

      const result = await validateNovel(novelPath);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('INVALID_MANIFEST');
      expect(result.error.message).toContain('meta');
    });

    it('should return error if index.json is missing', async () => {
      const novelPath = path.join(TEST_HOME, 'incomplete-novel-4');
      await mkdir(novelPath, { recursive: true });
      await mkdir(path.join(novelPath, 'manuscript'), { recursive: true });
      await mkdir(path.join(novelPath, 'wiki'), { recursive: true });
      await mkdir(path.join(novelPath, 'meta'), { recursive: true });

      const result = await validateNovel(novelPath);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('INVALID_MANIFEST');
      expect(result.error.message).toContain('index.json');
    });

    it('should return error if novel path does not exist', async () => {
      const novelPath = path.join(TEST_HOME, 'nonexistent-novel');
      const result = await validateNovel(novelPath);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('ENOENT');
    });
  });
});
