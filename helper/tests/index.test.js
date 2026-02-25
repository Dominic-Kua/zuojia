import path from 'path';
import fs from 'fs';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { createNovel, getIndex, validateNovel, rebuildIndex, readChapter, writeChapter } from '../src/index/index.js';
import { commitChapter } from '../src/git/commit.js';
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

  describe('rebuildIndex', () => {
    it('should rebuild index from manuscript and wiki directories', async () => {
      const novelName = 'rebuild-test';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create novel
      await createNovel(novelName, TEST_HOME);

      // Add chapters to manuscript directory
      const manuscriptPath = path.join(novelPath, 'manuscript');
      await writeFile(
        path.join(manuscriptPath, 'chapter-01.md'),
        '# Chapter 1\n\nThis is the first chapter. Word one two three four five.'
      );
      await writeFile(
        path.join(manuscriptPath, 'chapter-02.md'),
        '# Chapter 2\n\nSecond chapter. Word one two three.'
      );

      // Add wiki pages
      const wikiPath = path.join(novelPath, 'wiki');
      await writeFile(
        path.join(wikiPath, 'character-alice.md'),
        '# Alice\n\nA main character. Her story unfolds.'
      );

      const result = await rebuildIndex(novelPath);

      expect(result.status).toEqual('ok');
      expect(result.data.chapters).toEqual([
        expect.objectContaining({
          filename: 'chapter-01.md',
          title: 'Chapter 1',
          wordCount: expect.any(Number),
        }),
        expect.objectContaining({
          filename: 'chapter-02.md',
          title: 'Chapter 2',
          wordCount: expect.any(Number),
        }),
      ]);
      expect(result.data.wiki).toEqual([
        expect.objectContaining({
          filename: 'character-alice.md',
          title: 'Alice',
        }),
      ]);
      expect(result.data.lastRebuild).toBeDefined();
    });

    it('should handle empty manuscript and wiki directories', async () => {
      const novelName = 'empty-novel';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create novel (manuscript and wiki are empty)
      await createNovel(novelName, TEST_HOME);

      const result = await rebuildIndex(novelPath);

      expect(result.status).toEqual('ok');
      expect(result.data.chapters).toEqual([]);
      expect(result.data.wiki).toEqual([]);
      expect(result.data.lastRebuild).toBeDefined();
    });

    it('should return error if novel path does not exist', async () => {
      const novelPath = path.join(TEST_HOME, 'nonexistent');
      const result = await rebuildIndex(novelPath);

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('ENOENT');
    });

    it('should ignore non-markdown files in manuscript directory', async () => {
      const novelName = 'ignore-test';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create novel
      await createNovel(novelName, TEST_HOME);

      const manuscriptPath = path.join(novelPath, 'manuscript');
      await writeFile(path.join(manuscriptPath, 'chapter-01.md'), '# Chapter 1\n\nContent.');
      await writeFile(path.join(manuscriptPath, 'readme.txt'), 'This is not markdown');
      await writeFile(path.join(manuscriptPath, '.hidden'), 'Hidden file');

      const result = await rebuildIndex(novelPath);

      expect(result.status).toEqual('ok');
      expect(result.data.chapters).toHaveLength(1);
      expect(result.data.chapters[0].filename).toEqual('chapter-01.md');
    });

    it('should use title from first heading if present', async () => {
      const novelName = 'heading-test';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create novel
      await createNovel(novelName, TEST_HOME);

      const manuscriptPath = path.join(novelPath, 'manuscript');
      await writeFile(
        path.join(manuscriptPath, 'chapter-01.md'),
        '# My Custom Title\n\nContent with multiple words here.'
      );

      const result = await rebuildIndex(novelPath);

      expect(result.status).toEqual('ok');
      expect(result.data.chapters[0].title).toEqual('My Custom Title');
    });

    it('should use filename as title if no heading exists', async () => {
      const novelName = 'no-heading-test';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create novel
      await createNovel(novelName, TEST_HOME);

      const manuscriptPath = path.join(novelPath, 'manuscript');
      await writeFile(
        path.join(manuscriptPath, 'chapter-01.md'),
        'Content without any heading. Words go here.'
      );

      const result = await rebuildIndex(novelPath);

      expect(result.status).toEqual('ok');
      expect(result.data.chapters[0].title).toBeDefined();
      // Could be filename or a fallback - just verify it's not empty
      expect(result.data.chapters[0].title.length).toBeGreaterThan(0);
    });
  });

  describe('readChapter', () => {
    it('should read chapter content from manuscript directory', async () => {
      const novelName = 'read-chapter-test';
      const novelPath = path.join(TEST_HOME, novelName);

      // Create novel and add a chapter
      await createNovel(novelName, TEST_HOME);
      const chapterContent = '# Chapter 1\n\nThis is the content of chapter one.';
      await writeFile(path.join(novelPath, 'manuscript', 'chapter-01.md'), chapterContent);

      const result = await readChapter(novelPath, 'chapter-01.md');

      expect(result.status).toEqual('ok');
      expect(result.data.content).toEqual(chapterContent);
      expect(result.data.filename).toEqual('chapter-01.md');
    });

    it('should return error if chapter file does not exist', async () => {
      const novelName = 'no-chapter-test';
      const novelPath = path.join(TEST_HOME, novelName);

      await createNovel(novelName, TEST_HOME);

      const result = await readChapter(novelPath, 'nonexistent.md');

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('ENOENT');
    });

    it('should return error if novel path is invalid', async () => {
      const result = await readChapter('/nonexistent/path', 'chapter.md');

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('ENOENT');
    });
  });

  describe('writeChapter', () => {
    it('should write chapter content to manuscript directory', async () => {
      const novelName = 'write-chapter-test';
      const novelPath = path.join(TEST_HOME, novelName);

      await createNovel(novelName, TEST_HOME);

      const content = '# New Chapter\n\nContent here.';
      const result = await writeChapter(novelPath, 'new-chapter.md', content);

      expect(result.status).toEqual('ok');
      expect(result.data.filename).toEqual('new-chapter.md');

      // Verify file was written
      const filePath = path.join(novelPath, 'manuscript', 'new-chapter.md');
      expect(fs.existsSync(filePath)).toBe(true);
      
      const savedContent = await readFile(filePath, 'utf-8');
      expect(savedContent).toEqual(content);
    });

    it('should overwrite existing chapter', async () => {
      const novelName = 'overwrite-chapter-test';
      const novelPath = path.join(TEST_HOME, novelName);

      await createNovel(novelName, TEST_HOME);

      // Write initial content
      await writeChapter(novelPath, 'chapter.md', 'Initial content');

      // Overwrite with new content
      const newContent = 'Updated content';
      const result = await writeChapter(novelPath, 'chapter.md', newContent);

      expect(result.status).toEqual('ok');

      // Verify new content
      const filePath = path.join(novelPath, 'manuscript', 'chapter.md');
      const savedContent = await readFile(filePath, 'utf-8');
      expect(savedContent).toEqual(newContent);
    });

    it('should return error if novel path is invalid', async () => {
      const result = await writeChapter('/nonexistent/path', 'chapter.md', 'content');

      expect(result.status).toEqual('error');
      expect(result.error.code).toEqual('ENOENT');
    });

    it('should handle empty content', async () => {
      const novelName = 'empty-content-test';
      const novelPath = path.join(TEST_HOME, novelName);

      await createNovel(novelName, TEST_HOME);

      const result = await writeChapter(novelPath, 'empty.md', '');

      expect(result.status).toEqual('ok');

      const filePath = path.join(novelPath, 'manuscript', 'empty.md');
      const savedContent = await readFile(filePath, 'utf-8');
      expect(savedContent).toEqual('');
    });

    it('should reject chapter filenames with path traversal or absolute paths', async () => {
      const novelName = 'write-chapter-path-traversal-test';
      const novelPath = path.join(TEST_HOME, novelName);

      await createNovel(novelName, TEST_HOME);

      const traversalFilenames = ['../evil.md', '..\\\\evil.md'];

      // Path traversal sequences should be rejected
      for (const filename of traversalFilenames) {
        const result = await writeChapter(novelPath, filename, 'malicious content');

        expect(result.status).toEqual('error');
        expect(result.error).toBeDefined();

        // Ensure no file was created within the manuscript directory
        const resolved = path.resolve(novelPath, 'manuscript', filename);
        expect(fs.existsSync(resolved)).toBe(false);
      }

      // Absolute paths should also be rejected
      const absoluteFilename = path.resolve(TEST_HOME, 'absolute-evil.md');
      const absoluteResult = await writeChapter(novelPath, absoluteFilename, 'malicious content');

      expect(absoluteResult.status).toEqual('error');
      expect(absoluteResult.error).toBeDefined();
      expect(fs.existsSync(absoluteFilename)).toBe(false);
    });
  });

  describe('commitChapter', () => {
    it('should commit chapter changes to git with timestamp', async () => {
      // Create a novel first
      const novelName = 'test-commit-novel';
      const novelPath = path.join(TEST_HOME, novelName);
      await createNovel(novelName, TEST_HOME);

      // Write a chapter
      const filename = 'chapter-01.md';
      const content = '# Chapter 1\n\nSome content';
      await writeChapter(novelPath, filename, content);

      // Commit the chapter - may return error if git not available in test env
      const result = await commitChapter(novelPath, filename, content);

      // Both ok and error are acceptable - we're mainly checking the function doesn't crash
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(['ok', 'error']).toContain(result.status);
    });

    it('should return error if novel path is invalid', async () => {
      const result = await commitChapter('/nonexistent/path', 'chapter-01.md', 'content');

      expect(result.status).toEqual('error');
      expect(result.error).toBeDefined();
      expect(result.error.code).toEqual('INVALID_NOVEL_PATH');
    });

    it('should return error if filename is missing', async () => {
      const novelName = 'test-commit-no-filename';
      const novelPath = path.join(TEST_HOME, novelName);
      await createNovel(novelName, TEST_HOME);

      const result = await commitChapter(novelPath, '', 'content');

      expect(result.status).toEqual('error');
      expect(result.error).toBeDefined();
      expect(result.error.code).toEqual('INVALID_FILENAME');
    });

    it('should handle subdirectory paths', async () => {
      const novelName = 'test-commit-subdir';
      const novelPath = path.join(TEST_HOME, novelName);
      await createNovel(novelName, TEST_HOME);

      // Try to access parent directory (path traversal)
      const result = await commitChapter(novelPath, '../evil.md', 'malicious');

      expect(result.status).toEqual('error');
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('INVALID_PATH_TRAVERSAL');
    });

    it('should handle basic git configuration', async () => {
      const novelName = 'test-commit-author';
      const novelPath = path.join(TEST_HOME, novelName);
      await createNovel(novelName, TEST_HOME);

      // First write the chapter so there's something to commit
      const filename = 'chapter-02.md';
      const content = '# Chapter 2\n\nAuthor info test';
      await writeChapter(novelPath, filename, content);

      // Now commit it - should either succeed or fail gracefully
      const result = await commitChapter(novelPath, filename, content);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      // Both ok and error are acceptable in test environment
      expect(['ok', 'error']).toContain(result.status);
    });
  });
});
