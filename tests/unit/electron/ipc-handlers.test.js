// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock electron ──
const ipcHandleMap = new Map();
const mockIpcMain = {
  handle: vi.fn((channel, handler) => {
    ipcHandleMap.set(channel, handler);
  }),
};

const mockApp = {
  getPath: vi.fn(() => '/tmp/fake-user-data'),
  on: vi.fn(),
};

const mockDialog = {
  showOpenDialog: vi.fn(),
};

vi.mock('electron', () => ({
  app: mockApp,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
}));

// ── Mock fs ──
vi.mock('fs', () => {
  const existsSync = vi.fn(() => true);
  return {
    default: { existsSync, mkdirSync: vi.fn(), writeFileSync: vi.fn() },
    existsSync,
  };
});

vi.mock('fs/promises', () => {
  const mocks = {
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
    rename: vi.fn(),
  };
  return { default: mocks, ...mocks };
});

// ── Mock helper modules ──
const mockIndex = {
  createNovel: vi.fn(),
  getIndex: vi.fn(),
  validateNovel: vi.fn(),
  rebuildIndex: vi.fn(),
  readChapter: vi.fn(),
  writeChapter: vi.fn(),
};
vi.mock('../../../helper/src/index/index.js', () => mockIndex);

const mockCommit = {
  commitChapter: vi.fn(),
  createManualCommit: vi.fn(),
  getCommitHistory: vi.fn(),
  listChangedFiles: vi.fn(),
};
vi.mock('../../../helper/src/git/commit.js', () => mockCommit);

const mockGitConfig = {
  getGitSettings: vi.fn(),
  saveGitSettings: vi.fn(),
};
vi.mock('../../../helper/src/git/config.js', () => mockGitConfig);

const mockPush = { pushToRemote: vi.fn() };
vi.mock('../../../helper/src/git/push.js', () => mockPush);

const mockWordCount = { calculateWordCount: vi.fn() };
vi.mock('../../../helper/src/stats/word-count.js', () => mockWordCount);

const mockManuscriptCount = { getManuscriptWordCount: vi.fn() };
vi.mock('../../../helper/src/stats/manuscript-count.js', () => mockManuscriptCount);

const mockHistory = { getWordsWrittenToday: vi.fn() };
vi.mock('../../../helper/src/git/history.js', () => mockHistory);

const mockPdf = { exportManuscriptToPdf: vi.fn() };
vi.mock('../../../helper/src/export/pdf.js', () => mockPdf);

const mockValidateDeps = { validateExportDependencies: vi.fn() };
vi.mock('../../../helper/src/export/validate-deps.js', () => mockValidateDeps);

const mockExportLogs = { getExportLogs: vi.fn() };
vi.mock('../../../helper/src/export/logs.js', () => mockExportLogs);

const mockWikiCrud = {
  createWikiPage: vi.fn(),
  readWikiPage: vi.fn(),
  updateWikiPage: vi.fn(),
  deleteWikiPage: vi.fn(),
  renameWikiPage: vi.fn(),
};
vi.mock('../../../helper/src/wiki/crud.js', () => mockWikiCrud);

const mockWikiList = { listWikiPages: vi.fn() };
vi.mock('../../../helper/src/wiki/list-pages.js', () => mockWikiList);

const mockSpellcheck = {
  rebuildSpellcheckDict: vi.fn(),
  getSpellcheckDict: vi.fn(),
  addWordToSpellcheckDict: vi.fn(),
};
vi.mock('../../../helper/src/wiki/rebuild-dict.js', () => mockSpellcheck);

const mockSnapshot = {
  createSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  deleteSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
};
vi.mock('../../../helper/src/backup/snapshot.js', () => mockSnapshot);

// ── Mock runtime managers ──
const mockLlmRuntime = {
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  health: vi.fn(),
  getLogs: vi.fn(),
};

const mockMcpRuntime = {
  start: vi.fn(),
  stop: vi.fn(),
  health: vi.fn(),
  callTool: vi.fn(),
  getLogs: vi.fn(),
};

const mockNeo4jRuntime = {
  start: vi.fn(),
  stop: vi.fn(),
  health: vi.fn(),
  importWikiData: vi.fn(),
  queryCypher: vi.fn(),
  naturalLanguageSearch: vi.fn(),
  getLogs: vi.fn(),
};

const mockOrchestrator = {
  startAll: vi.fn(),
  stopAll: vi.fn(),
};

vi.mock('../../../electron/llm-runtime.js', () => ({
  createLlmRuntimeManager: vi.fn(() => mockLlmRuntime),
}));

vi.mock('../../../electron/mcp-runtime.js', () => ({
  createMcpRuntimeManager: vi.fn(() => mockMcpRuntime),
}));

vi.mock('../../../electron/neo4j-runtime.js', () => ({
  createNeo4jRuntimeManager: vi.fn(() => mockNeo4jRuntime),
}));

vi.mock('../../../electron/orchestrator.js', () => ({
  createOrchestrator: vi.fn(() => mockOrchestrator),
}));

const mockLoadLlmConfig = vi.fn();
const mockSaveLlmConfig = vi.fn();
const mockValidateLlmConfig = vi.fn();
vi.mock('../../../electron/llm-config.js', () => ({
  loadLlmConfig: mockLoadLlmConfig,
  saveLlmConfig: mockSaveLlmConfig,
  validateLlmConfig: mockValidateLlmConfig,
}));

// ── Import and register ──
const ipcModule = await import('../../../electron/ipc-handlers.js');
ipcModule.registerHandlers();

// ── Helpers ──
function getHandler(channel) {
  const h = ipcHandleMap.get(channel);
  if (!h) throw new Error(`No handler for: ${channel}`);
  return h;
}

async function callHandler(channel, payload) {
  return await getHandler(channel)({}, payload);
}

async function callRawHandler(channel, event, payload) {
  return await getHandler(channel)(event, payload);
}

describe('ipc-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadLlmConfig.mockResolvedValue({
      provider: 'llamacpp',
      executablePath: '/opt/homebrew/bin/llama-server',
      modelName: 'gemma4',
      host: '127.0.0.1',
      port: 8080,
      temperature: 0.7,
      maxTokens: 2048,
      ngl: 99,
      ctxSize: 4096,
    });
    mockValidateLlmConfig.mockImplementation((c) => c);
  });

  // ── Registration ──
  describe('registerHandlers', () => {
    it('registers all expected IPC channels', () => {
      const expected = [
        'helper:index:createNovel', 'helper:index:get', 'helper:index:validate', 'helper:index:rebuild',
        'helper:chapter:read', 'helper:chapter:write',
        'helper:git:commit', 'helper:git:listChanges', 'helper:git:manualCommit',
        'helper:git:getConfig', 'helper:git:saveConfig', 'helper:git:history', 'helper:git:push',
        'helper:export:pdf', 'helper:export:validateDeps', 'helper:export:getLogs',
        'helper:stats:word-count', 'helper:stats:manuscript-count', 'helper:stats:today-count',
        'helper:wiki:create', 'helper:wiki:read', 'helper:wiki:update', 'helper:wiki:delete',
        'helper:wiki:rename', 'helper:wiki:list',
        'helper:wiki:rebuildDict', 'helper:wiki:getSpellcheckDict', 'helper:wiki:addToDict',
        'helper:backup:createSnapshot', 'helper:backup:listSnapshots',
        'helper:backup:deleteSnapshot', 'helper:backup:restore',
        'helper:llm:getConfig', 'helper:llm:saveConfig',
        'helper:llm:startRuntime', 'helper:llm:stopRuntime', 'helper:llm:restartRuntime',
        'helper:llm:health', 'helper:llm:chat',
        'helper:mcp:startServer', 'helper:mcp:stopServer', 'helper:mcp:health',
        'helper:mcp:callTool', 'helper:mcp:getLogs',
        'app:listNovels', 'app:markNovelOpened', 'app:selectNovelDirectory',
        'helper:neo4j:start', 'helper:neo4j:stop', 'helper:neo4j:health',
        'helper:neo4j:import', 'helper:neo4j:query', 'helper:neo4j:search', 'helper:neo4j:getLogs',
        'app:startNovelServices', 'app:stopNovelServices',
      ];
      for (const ch of expected) {
        expect(ipcHandleMap.has(ch), `Missing handler for: ${ch}`).toBe(true);
      }
    });

  });

  // ── Index handlers (wrapHandler — raw passthrough) ──
  describe('index handlers', () => {
    it('helper:index:createNovel delegates to createNovel', async () => {
      mockIndex.createNovel.mockResolvedValue({ novelPath: '/tmp/novel' });
      const result = await callHandler('helper:index:createNovel', { novelName: 'My Novel' });
      expect(mockIndex.createNovel).toHaveBeenCalledWith('My Novel');
      expect(result).toEqual({ novelPath: '/tmp/novel' });
    });

    it('helper:index:get delegates to getIndex', async () => {
      mockIndex.getIndex.mockResolvedValue({ chapters: [] });
      const result = await callHandler('helper:index:get', { novelPath: '/tmp/novel' });
      expect(mockIndex.getIndex).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ chapters: [] });
    });

    it('helper:index:validate delegates to validateNovel', async () => {
      mockIndex.validateNovel.mockResolvedValue({ valid: true });
      const result = await callHandler('helper:index:validate', { novelPath: '/tmp/novel' });
      expect(mockIndex.validateNovel).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ valid: true });
    });

    it('helper:index:rebuild delegates to rebuildIndex', async () => {
      mockIndex.rebuildIndex.mockResolvedValue({ rebuilt: true });
      const result = await callHandler('helper:index:rebuild', { novelPath: '/tmp/novel' });
      expect(mockIndex.rebuildIndex).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ rebuilt: true });
    });
  });

  // ── Chapter handlers ──
  describe('chapter handlers', () => {
    it('helper:chapter:read delegates to readChapter', async () => {
      mockIndex.readChapter.mockResolvedValue({ content: '# Hello' });
      const result = await callHandler('helper:chapter:read', { novelPath: '/tmp/novel', filename: '001-intro.md' });
      expect(mockIndex.readChapter).toHaveBeenCalledWith('/tmp/novel', '001-intro.md');
      expect(result).toEqual({ content: '# Hello' });
    });

    it('helper:chapter:write delegates to writeChapter', async () => {
      mockIndex.writeChapter.mockResolvedValue({ written: true });
      const result = await callHandler('helper:chapter:write', { novelPath: '/tmp/novel', filename: '001-intro.md', content: 'Hello' });
      expect(mockIndex.writeChapter).toHaveBeenCalledWith('/tmp/novel', '001-intro.md', 'Hello');
      expect(result).toEqual({ written: true });
    });
  });

  // ── Git handlers ──
  describe('git handlers', () => {
    it('helper:git:commit delegates to commitChapter', async () => {
      mockCommit.commitChapter.mockResolvedValue({ hash: 'abc123' });
      const result = await callHandler('helper:git:commit', { novelPath: '/tmp/novel', filename: 'test.md', content: 'x' });
      expect(mockCommit.commitChapter).toHaveBeenCalledWith('/tmp/novel', 'test.md', 'x');
      expect(result).toEqual({ hash: 'abc123' });
    });

    it('helper:git:listChanges delegates to listChangedFiles', async () => {
      mockCommit.listChangedFiles.mockResolvedValue({ files: ['a.md'] });
      const result = await callHandler('helper:git:listChanges', { novelPath: '/tmp/novel' });
      expect(mockCommit.listChangedFiles).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ files: ['a.md'] });
    });

    it('helper:git:manualCommit delegates to createManualCommit', async () => {
      mockCommit.createManualCommit.mockResolvedValue({ hash: 'def456' });
      const result = await callHandler('helper:git:manualCommit', { novelPath: '/tmp/novel', files: ['a.md'], message: 'msg' });
      expect(mockCommit.createManualCommit).toHaveBeenCalledWith('/tmp/novel', ['a.md'], 'msg');
      expect(result).toEqual({ hash: 'def456' });
    });

    it('helper:git:getConfig delegates to getGitSettings', async () => {
      mockGitConfig.getGitSettings.mockResolvedValue({ remote: 'origin' });
      const result = await callHandler('helper:git:getConfig', { novelPath: '/tmp/novel' });
      expect(mockGitConfig.getGitSettings).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ remote: 'origin' });
    });

    it('helper:git:saveConfig delegates to saveGitSettings', async () => {
      mockGitConfig.saveGitSettings.mockResolvedValue({ saved: true });
      const result = await callHandler('helper:git:saveConfig', { novelPath: '/tmp/novel', settings: { remote: 'origin' } });
      expect(mockGitConfig.saveGitSettings).toHaveBeenCalledWith('/tmp/novel', { remote: 'origin' });
      expect(result).toEqual({ saved: true });
    });

    it('helper:git:history delegates to getCommitHistory', async () => {
      mockCommit.getCommitHistory.mockResolvedValue({ commits: [] });
      const result = await callHandler('helper:git:history', { novelPath: '/tmp/novel', limit: 10 });
      expect(mockCommit.getCommitHistory).toHaveBeenCalledWith('/tmp/novel', 10);
      expect(result).toEqual({ commits: [] });
    });

    it('helper:git:push delegates to pushToRemote', async () => {
      mockPush.pushToRemote.mockResolvedValue({ pushed: true });
      const result = await callHandler('helper:git:push', { novelPath: '/tmp/novel' });
      expect(mockPush.pushToRemote).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ pushed: true });
    });
  });

  // ── Export handlers ──
  describe('export handlers', () => {
    it('helper:export:pdf delegates to exportManuscriptToPdf', async () => {
      mockPdf.exportManuscriptToPdf.mockResolvedValue({ outputPath: '/tmp/out.pdf' });
      const result = await callHandler('helper:export:pdf', { novelPath: '/tmp/novel', metadata: {} });
      expect(mockPdf.exportManuscriptToPdf).toHaveBeenCalledWith('/tmp/novel', {});
      expect(result).toEqual({ outputPath: '/tmp/out.pdf' });
    });

    it('helper:export:validateDeps delegates to validateExportDependencies', async () => {
      mockValidateDeps.validateExportDependencies.mockResolvedValue({ ok: true });
      const result = await callHandler('helper:export:validateDeps', {});
      expect(mockValidateDeps.validateExportDependencies).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('helper:export:getLogs delegates to getExportLogs', async () => {
      mockExportLogs.getExportLogs.mockResolvedValue({ logs: [] });
      const result = await callHandler('helper:export:getLogs', { novelPath: '/tmp/novel', limit: 20 });
      expect(mockExportLogs.getExportLogs).toHaveBeenCalledWith('/tmp/novel', 20);
      expect(result).toEqual({ logs: [] });
    });
  });

  // ── Stats handlers (try/catch — wrapped in {status, data, timestamp}) ──
  describe('stats handlers', () => {
    it('helper:stats:word-count returns word count', async () => {
      mockWordCount.calculateWordCount.mockReturnValue(42);
      const result = await callHandler('helper:stats:word-count', { content: 'hello world' });
      expect(result.status).toBe('ok');
      expect(result.data.wordCount).toBe(42);
    });

    it('helper:stats:word-count returns error on exception', async () => {
      mockWordCount.calculateWordCount.mockImplementation(() => { throw new Error('bad'); });
      const result = await callHandler('helper:stats:word-count', { content: '' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('WORD_COUNT_ERROR');
    });

    it('helper:stats:manuscript-count returns word count', async () => {
      mockManuscriptCount.getManuscriptWordCount.mockResolvedValue(1000);
      const result = await callHandler('helper:stats:manuscript-count', { novelPath: '/tmp/novel' });
      expect(result.status).toBe('ok');
      expect(result.data.wordCount).toBe(1000);
    });

    it('helper:stats:manuscript-count returns error on exception', async () => {
      mockManuscriptCount.getManuscriptWordCount.mockRejectedValue(new Error('fail'));
      const result = await callHandler('helper:stats:manuscript-count', { novelPath: '/tmp/novel' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('MANUSCRIPT_COUNT_ERROR');
    });

    it('helper:stats:today-count returns word count', async () => {
      mockHistory.getWordsWrittenToday.mockResolvedValue(250);
      const result = await callHandler('helper:stats:today-count', { novelPath: '/tmp/novel' });
      expect(result.status).toBe('ok');
      expect(result.data.wordCount).toBe(250);
    });

    it('helper:stats:today-count returns error on exception', async () => {
      mockHistory.getWordsWrittenToday.mockRejectedValue(new Error('git fail'));
      const result = await callHandler('helper:stats:today-count', { novelPath: '/tmp/novel' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('TODAY_COUNT_ERROR');
    });
  });

  // ── Wiki handlers (wrapHandler — raw passthrough) ──
  describe('wiki handlers', () => {
    it('helper:wiki:create delegates to createWikiPage', async () => {
      mockWikiCrud.createWikiPage.mockResolvedValue({ slug: 'hero' });
      const result = await callHandler('helper:wiki:create', { novelPath: '/tmp/novel', title: 'Hero', content: 'body', tags: ['tag'] });
      expect(mockWikiCrud.createWikiPage).toHaveBeenCalledWith('/tmp/novel', 'Hero', 'body', ['tag']);
      expect(result).toEqual({ slug: 'hero' });
    });

    it('helper:wiki:read delegates to readWikiPage', async () => {
      mockWikiCrud.readWikiPage.mockResolvedValue({ content: 'page' });
      const result = await callHandler('helper:wiki:read', { novelPath: '/tmp/novel', slug: 'hero' });
      expect(mockWikiCrud.readWikiPage).toHaveBeenCalledWith('/tmp/novel', 'hero');
      expect(result).toEqual({ content: 'page' });
    });

    it('helper:wiki:update delegates to updateWikiPage', async () => {
      mockWikiCrud.updateWikiPage.mockResolvedValue({ updated: true });
      const result = await callHandler('helper:wiki:update', { novelPath: '/tmp/novel', slug: 'hero', content: 'new', tags: [] });
      expect(mockWikiCrud.updateWikiPage).toHaveBeenCalledWith('/tmp/novel', 'hero', 'new', []);
      expect(result).toEqual({ updated: true });
    });

    it('helper:wiki:delete delegates to deleteWikiPage', async () => {
      mockWikiCrud.deleteWikiPage.mockResolvedValue({ deleted: true });
      const result = await callHandler('helper:wiki:delete', { novelPath: '/tmp/novel', slug: 'hero' });
      expect(mockWikiCrud.deleteWikiPage).toHaveBeenCalledWith('/tmp/novel', 'hero');
      expect(result).toEqual({ deleted: true });
    });

    it('helper:wiki:rename delegates to renameWikiPage', async () => {
      mockWikiCrud.renameWikiPage.mockResolvedValue({ renamed: true });
      const result = await callHandler('helper:wiki:rename', { novelPath: '/tmp/novel', oldSlug: 'hero', newTitle: 'Villain' });
      expect(mockWikiCrud.renameWikiPage).toHaveBeenCalledWith('/tmp/novel', 'hero', 'Villain');
      expect(result).toEqual({ renamed: true });
    });

    it('helper:wiki:list delegates to listWikiPages', async () => {
      mockWikiList.listWikiPages.mockResolvedValue({ pages: ['hero', 'villain'] });
      const result = await callHandler('helper:wiki:list', { novelPath: '/tmp/novel' });
      expect(mockWikiList.listWikiPages).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ pages: ['hero', 'villain'] });
    });

    it('helper:wiki:rebuildDict delegates to rebuildSpellcheckDict', async () => {
      mockSpellcheck.rebuildSpellcheckDict.mockResolvedValue({ rebuilt: true });
      const result = await callHandler('helper:wiki:rebuildDict', { novelPath: '/tmp/novel' });
      expect(mockSpellcheck.rebuildSpellcheckDict).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ rebuilt: true });
    });

    it('helper:wiki:getSpellcheckDict delegates to getSpellcheckDict', async () => {
      mockSpellcheck.getSpellcheckDict.mockResolvedValue({ words: ['ok'] });
      const result = await callHandler('helper:wiki:getSpellcheckDict', { novelPath: '/tmp/novel' });
      expect(mockSpellcheck.getSpellcheckDict).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ words: ['ok'] });
    });

    it('helper:wiki:addToDict delegates to addWordToSpellcheckDict', async () => {
      mockSpellcheck.addWordToSpellcheckDict.mockResolvedValue({ added: true });
      const result = await callHandler('helper:wiki:addToDict', { novelPath: '/tmp/novel', word: 'foo' });
      expect(mockSpellcheck.addWordToSpellcheckDict).toHaveBeenCalledWith('/tmp/novel', 'foo');
      expect(result).toEqual({ added: true });
    });
  });

  // ── Backup/Snapshot handlers (wrapHandler — raw passthrough) ──
  describe('backup handlers', () => {
    it('helper:backup:createSnapshot delegates to createSnapshot', async () => {
      mockSnapshot.createSnapshot.mockResolvedValue({ id: 'snap1' });
      const result = await callHandler('helper:backup:createSnapshot', { novelPath: '/tmp/novel', label: 'test' });
      expect(mockSnapshot.createSnapshot).toHaveBeenCalledWith('/tmp/novel', 'test');
      expect(result).toEqual({ id: 'snap1' });
    });

    it('helper:backup:createSnapshot passes null when label omitted', async () => {
      mockSnapshot.createSnapshot.mockResolvedValue({ id: 'snap1' });
      await callHandler('helper:backup:createSnapshot', { novelPath: '/tmp/novel' });
      expect(mockSnapshot.createSnapshot).toHaveBeenCalledWith('/tmp/novel', null);
    });

    it('helper:backup:listSnapshots delegates to listSnapshots', async () => {
      mockSnapshot.listSnapshots.mockResolvedValue({ snapshots: [] });
      const result = await callHandler('helper:backup:listSnapshots', { novelPath: '/tmp/novel' });
      expect(mockSnapshot.listSnapshots).toHaveBeenCalledWith('/tmp/novel');
      expect(result).toEqual({ snapshots: [] });
    });

    it('helper:backup:deleteSnapshot delegates to deleteSnapshot', async () => {
      mockSnapshot.deleteSnapshot.mockResolvedValue({ deleted: true });
      const result = await callHandler('helper:backup:deleteSnapshot', { novelPath: '/tmp/novel', timestamp: '2024-01-01' });
      expect(mockSnapshot.deleteSnapshot).toHaveBeenCalledWith('/tmp/novel', '2024-01-01');
      expect(result).toEqual({ deleted: true });
    });

    it('helper:backup:restore delegates to restoreSnapshot with timestamp', async () => {
      mockSnapshot.restoreSnapshot.mockResolvedValue({ restored: true });
      const result = await callHandler('helper:backup:restore', { novelPath: '/tmp/novel', timestamp: '2024-01-01', snapshotId: 'snap1' });
      expect(mockSnapshot.restoreSnapshot).toHaveBeenCalledWith('/tmp/novel', '2024-01-01');
      expect(result).toEqual({ restored: true });
    });

    it('helper:backup:restore falls back to snapshotId when timestamp is null', async () => {
      mockSnapshot.restoreSnapshot.mockResolvedValue({ restored: true });
      const result = await callHandler('helper:backup:restore', { novelPath: '/tmp/novel', timestamp: null, snapshotId: 'snap2' });
      expect(mockSnapshot.restoreSnapshot).toHaveBeenCalledWith('/tmp/novel', 'snap2');
      expect(result).toEqual({ restored: true });
    });
  });

  // ── LLM config handlers (try/catch — wrapped) ──
  describe('LLM config handlers', () => {
    it('helper:llm:getConfig loads config', async () => {
      mockLoadLlmConfig.mockResolvedValue({ modelName: 'gemma4' });
      const result = await callHandler('helper:llm:getConfig', {});
      expect(result.status).toBe('ok');
      expect(result.data.modelName).toBe('gemma4');
    });

    it('helper:llm:getConfig returns error on failure', async () => {
      mockLoadLlmConfig.mockRejectedValue(new Error('read fail'));
      const result = await callHandler('helper:llm:getConfig', {});
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('LLM_CONFIG_LOAD_ERROR');
    });

    it('helper:llm:saveConfig saves config', async () => {
      mockSaveLlmConfig.mockResolvedValue({ saved: true });
      const result = await callHandler('helper:llm:saveConfig', { settings: { port: 9000 } });
      expect(mockSaveLlmConfig).toHaveBeenCalled();
      expect(result.status).toBe('ok');
    });

    it('helper:llm:saveConfig returns error on failure', async () => {
      mockSaveLlmConfig.mockRejectedValue(new Error('write fail'));
      const result = await callHandler('helper:llm:saveConfig', { settings: {} });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('LLM_CONFIG_SAVE_ERROR');
    });
  });

  // ── LLM runtime handlers (try/catch — wrapped) ──
  describe('LLM runtime handlers', () => {
    it('helper:llm:startRuntime starts with resolved config', async () => {
      mockLlmRuntime.start.mockResolvedValue({ status: 'running', pid: 1234 });
      const result = await callHandler('helper:llm:startRuntime', { settings: {} });
      expect(mockLlmRuntime.start).toHaveBeenCalled();
      expect(result.status).toBe('ok');
      expect(result.data.status).toBe('running');
    });

    it('helper:llm:startRuntime returns error on failure', async () => {
      mockLlmRuntime.start.mockRejectedValue(new Error('spawn fail'));
      const result = await callHandler('helper:llm:startRuntime', { settings: {} });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('LLM_RUNTIME_START_ERROR');
    });

    it('helper:llm:stopRuntime stops the runtime', async () => {
      mockLlmRuntime.stop.mockResolvedValue({ status: 'stopped' });
      const result = await callHandler('helper:llm:stopRuntime', {});
      expect(result.status).toBe('ok');
      expect(result.data.status).toBe('stopped');
    });

    it('helper:llm:stopRuntime returns error on failure', async () => {
      mockLlmRuntime.stop.mockRejectedValue(new Error('kill fail'));
      const result = await callHandler('helper:llm:stopRuntime', {});
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('LLM_RUNTIME_STOP_ERROR');
    });

    it('helper:llm:restartRuntime restarts with resolved config', async () => {
      mockLlmRuntime.restart.mockResolvedValue({ status: 'running', pid: 5678 });
      const result = await callHandler('helper:llm:restartRuntime', { settings: {} });
      expect(mockLlmRuntime.restart).toHaveBeenCalled();
      expect(result.status).toBe('ok');
    });

    it('helper:llm:restartRuntime returns error on failure', async () => {
      mockLlmRuntime.restart.mockRejectedValue(new Error('restart fail'));
      const result = await callHandler('helper:llm:restartRuntime', { settings: {} });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('LLM_RUNTIME_RESTART_ERROR');
    });

    it('helper:llm:health returns health status', async () => {
      mockLlmRuntime.health.mockResolvedValue({ status: 'running', pid: 1234, uptimeMs: 5000 });
      const result = await callHandler('helper:llm:health', {});
      expect(result.status).toBe('ok');
      expect(result.data.status).toBe('running');
    });
  });

  // ── LLM chat handler (try/catch — wrapped) ──
  describe('LLM chat handler', () => {
    it('helper:llm:chat rejects empty messages', async () => {
      const result = await callHandler('helper:llm:chat', { messages: [] });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('LLM_CHAT_ERROR');
    });

    it('helper:llm:chat rejects non-array messages', async () => {
      const result = await callHandler('helper:llm:chat', { messages: null });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('LLM_CHAT_ERROR');
    });

    it('helper:llm:chat rejects when no model configured', async () => {
      mockLoadLlmConfig.mockResolvedValue({ modelName: '' });
      const result = await callHandler('helper:llm:chat', { messages: [{ role: 'user', content: 'hi' }] });
      expect(result.status).toBe('error');
      expect(result.error.message).toContain('not configured');
    });
  });

  // ── MCP runtime handlers (try/catch — wrapped) ──
  describe('MCP runtime handlers', () => {
    it('helper:mcp:startServer starts the MCP runtime', async () => {
      mockMcpRuntime.start.mockResolvedValue({ status: 'running', pid: 9999 });
      const result = await callHandler('helper:mcp:startServer', { novelPath: '/tmp/novel' });
      expect(mockMcpRuntime.start).toHaveBeenCalledWith({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('ok');
      expect(result.data.status).toBe('running');
    });

    it('helper:mcp:startServer returns error on failure', async () => {
      mockMcpRuntime.start.mockRejectedValue(new Error('spawn fail'));
      const result = await callHandler('helper:mcp:startServer', { novelPath: '/tmp/novel' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('MCP_START_ERROR');
    });

    it('helper:mcp:stopServer stops the MCP runtime', async () => {
      mockMcpRuntime.stop.mockResolvedValue({ status: 'stopped' });
      const result = await callHandler('helper:mcp:stopServer', {});
      expect(result.status).toBe('ok');
    });

    it('helper:mcp:stopServer returns error on failure', async () => {
      mockMcpRuntime.stop.mockRejectedValue(new Error('stop fail'));
      const result = await callHandler('helper:mcp:stopServer', {});
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('MCP_STOP_ERROR');
    });

    it('helper:mcp:health returns health status', async () => {
      mockMcpRuntime.health.mockReturnValue({ status: 'running', pid: 9999 });
      const result = await callHandler('helper:mcp:health', {});
      expect(result.status).toBe('ok');
      expect(result.data.status).toBe('running');
    });

    it('helper:mcp:callTool calls the tool and returns result', async () => {
      mockMcpRuntime.callTool.mockResolvedValue({ status: 'ok', data: { pages: [] } });
      const result = await callHandler('helper:mcp:callTool', { toolName: 'wiki_list_pages', args: {}, timeoutMs: 5000, retries: 0 });
      expect(mockMcpRuntime.callTool).toHaveBeenCalledWith({ toolName: 'wiki_list_pages', args: {}, timeoutMs: 5000, retries: 0 });
      expect(result.status).toBe('ok');
    });

    it('helper:mcp:callTool returns error with suggestion', async () => {
      mockMcpRuntime.callTool.mockRejectedValue(new Error('tool failed'));
      const result = await callHandler('helper:mcp:callTool', { toolName: 'wiki_list_pages', args: {} });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('MCP_TOOL_CALL_ERROR');
      expect(result.error.suggestion).toContain('getLogs');
    });

    it('helper:mcp:getLogs returns logs', async () => {
      mockMcpRuntime.getLogs.mockReturnValue([{ toolName: 'wiki_list_pages' }]);
      const result = await callHandler('helper:mcp:getLogs', { limit: 10 });
      expect(result.status).toBe('ok');
      expect(result.data.logs).toHaveLength(1);
    });
  });

  // ── Neo4j handlers (mix of wrapHandler and try/catch) ──
  describe('Neo4j handlers', () => {
    it('helper:neo4j:start starts the neo4j runtime (try/catch wrapped)', async () => {
      mockNeo4jRuntime.start.mockResolvedValue({ status: 'running', pid: 5555 });
      const result = await callHandler('helper:neo4j:start', { novelPath: '/tmp/novel', databaseName: 'wiki' });
      expect(mockNeo4jRuntime.start).toHaveBeenCalledWith({ novelPath: '/tmp/novel', databaseName: 'wiki' });
      expect(result.status).toBe('ok');
    });

    it('helper:neo4j:start defaults databaseName to wiki', async () => {
      mockNeo4jRuntime.start.mockResolvedValue({ status: 'running' });
      await callHandler('helper:neo4j:start', { novelPath: '/tmp/novel' });
      expect(mockNeo4jRuntime.start).toHaveBeenCalledWith({ novelPath: '/tmp/novel', databaseName: 'wiki' });
    });

    it('helper:neo4j:start returns error on failure', async () => {
      mockNeo4jRuntime.start.mockRejectedValue(new Error('neo4j fail'));
      const result = await callHandler('helper:neo4j:start', { novelPath: '/tmp/novel' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NEO4J_START_ERROR');
    });

    it('helper:neo4j:stop stops the neo4j runtime (try/catch wrapped)', async () => {
      mockNeo4jRuntime.stop.mockResolvedValue({ status: 'stopped' });
      const result = await callHandler('helper:neo4j:stop', {});
      expect(result.status).toBe('ok');
    });

    it('helper:neo4j:stop returns error on failure', async () => {
      mockNeo4jRuntime.stop.mockRejectedValue(new Error('stop fail'));
      const result = await callHandler('helper:neo4j:stop', {});
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NEO4J_STOP_ERROR');
    });

    it('helper:neo4j:health returns health (envelope)', async () => {
      mockNeo4jRuntime.health.mockReturnValue({ status: 'running', pid: 5555 });
      const result = await callHandler('helper:neo4j:health', {});
      expect(result.status).toBe('ok');
      expect(result.data).toEqual({ status: 'running', pid: 5555 });
    });

    it('helper:neo4j:import imports wiki data (try/catch wrapped)', async () => {
      mockNeo4jRuntime.importWikiData.mockResolvedValue({ status: 'ok', nodesImported: 5 });
      const result = await callHandler('helper:neo4j:import', {});
      expect(result.status).toBe('ok');
      expect(result.data.nodesImported).toBe(5);
    });

    it('helper:neo4j:import returns error on failure', async () => {
      mockNeo4jRuntime.importWikiData.mockRejectedValue(new Error('import fail'));
      const result = await callHandler('helper:neo4j:import', {});
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NEO4J_IMPORT_ERROR');
    });

    it('helper:neo4j:query executes a Cypher query (try/catch wrapped)', async () => {
      mockNeo4jRuntime.queryCypher.mockResolvedValue({ status: 'ok', data: [{ n: 1 }] });
      const result = await callHandler('helper:neo4j:query', { query: 'MATCH (n) RETURN n', params: {} });
      expect(mockNeo4jRuntime.queryCypher).toHaveBeenCalledWith('MATCH (n) RETURN n', {});
      expect(result.status).toBe('ok');
    });

    it('helper:neo4j:query returns error on failure', async () => {
      mockNeo4jRuntime.queryCypher.mockRejectedValue(new Error('cypher fail'));
      const result = await callHandler('helper:neo4j:query', { query: 'BAD' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NEO4J_QUERY_ERROR');
    });

    it('helper:neo4j:search performs a search (try/catch wrapped)', async () => {
      mockNeo4jRuntime.naturalLanguageSearch.mockResolvedValue({ status: 'ok', data: { results: [] } });
      const result = await callHandler('helper:neo4j:search', { query: 'hero', limit: 5 });
      expect(mockNeo4jRuntime.naturalLanguageSearch).toHaveBeenCalledWith('hero', 5);
      expect(result.status).toBe('ok');
    });

    it('helper:neo4j:search defaults limit to 10', async () => {
      mockNeo4jRuntime.naturalLanguageSearch.mockResolvedValue({ status: 'ok', data: { results: [] } });
      await callHandler('helper:neo4j:search', { query: 'hero' });
      expect(mockNeo4jRuntime.naturalLanguageSearch).toHaveBeenCalledWith('hero', 10);
    });

    it('helper:neo4j:search returns error on failure', async () => {
      mockNeo4jRuntime.naturalLanguageSearch.mockRejectedValue(new Error('search fail'));
      const result = await callHandler('helper:neo4j:search', { query: 'hero' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NEO4J_SEARCH_ERROR');
    });

    it('helper:neo4j:getLogs returns logs (envelope)', async () => {
      mockNeo4jRuntime.getLogs.mockReturnValue([{ type: 'neo4j_connected' }]);
      const result = await callHandler('helper:neo4j:getLogs', { limit: 5 });
      expect(result.status).toBe('ok');
      expect(result.data.logs).toEqual([{ type: 'neo4j_connected' }]);
    });
  });

  // ── App-level handlers ──
  describe('app:listNovels', () => {
    it('returns empty list when .zuojia dir missing', async () => {
      const fs = await import('fs');
      fs.default.existsSync.mockReturnValue(false);
      const result = await callRawHandler('app:listNovels', {});
      expect(result.status).toBe('ok');
      expect(result.data.novels).toEqual([]);
    });

    it('returns sorted novels with last-accessed metadata', async () => {
      const fs = await import('fs');
      const fsp = await import('fs/promises');

      fs.default.existsSync.mockReturnValue(true);
      fsp.default.readdir.mockResolvedValue([
        { name: 'novel-b', isDirectory: () => true, isFile: () => false },
        { name: 'novel-a', isDirectory: () => true, isFile: () => false },
      ]);
      fsp.default.readFile.mockImplementation((p) => {
        if (String(p).includes('novel-a')) {
          return Promise.resolve(JSON.stringify({ lastAccessed: '2024-06-01T00:00:00.000Z' }));
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
      fsp.default.stat.mockResolvedValue({ mtime: new Date('2024-05-01') });

      const result = await callRawHandler('app:listNovels', {});
      expect(result.status).toBe('ok');
      expect(result.data.novels).toHaveLength(2);
      expect(result.data.novels[0].slug).toBe('novel-a');
    });
  });

  describe('app:markNovelOpened', () => {
    it('returns error when meta dir missing', async () => {
      const fs = await import('fs');
      fs.default.existsSync.mockReturnValue(false);
      const result = await callRawHandler('app:markNovelOpened', {}, { novelPath: '/tmp/novel' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('META_DIR_MISSING');
    });

    it('writes last-accessed.json', async () => {
      const fs = await import('fs');
      const fsp = await import('fs/promises');
      fs.default.existsSync.mockReturnValue(true);
      fsp.default.writeFile.mockResolvedValue();
      const result = await callRawHandler('app:markNovelOpened', {}, { novelPath: '/tmp/novel' });
      expect(result.status).toBe('ok');
      expect(result.data.lastAccessed).toBeTruthy();
    });
  });

  describe('app:selectNovelDirectory', () => {
    it('returns selected path', async () => {
      mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/novel'] });
      const result = await callRawHandler('app:selectNovelDirectory', {});
      expect(result.status).toBe('ok');
      expect(result.data.novelPath).toBe('/tmp/novel');
    });

    it('returns error when canceled', async () => {
      mockDialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
      const result = await callRawHandler('app:selectNovelDirectory', {});
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('DIALOG_CANCELED');
    });
  });

  // ── Orchestrator handlers (try/catch inside wrapHandler — wrapped) ──
  describe('orchestrator handlers', () => {
    it('app:startNovelServices delegates to orchestrator.startAll', async () => {
      mockOrchestrator.startAll.mockResolvedValue({ status: 'ok', neo4j: { status: 'running' } });
      const result = await callHandler('app:startNovelServices', { novelPath: '/tmp/novel' });
      expect(mockOrchestrator.startAll).toHaveBeenCalledWith({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('ok');
      expect(result.data).toEqual({ status: 'ok', neo4j: { status: 'running' } });
    });

    it('app:startNovelServices returns error envelope on failure', async () => {
      mockOrchestrator.startAll.mockRejectedValue(new Error('start fail'));
      const result = await callHandler('app:startNovelServices', { novelPath: '/tmp/novel' });
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NOVEL_SERVICES_START_ERROR');
      expect(result.error.message).toBe('start fail');
    });

    it('app:stopNovelServices delegates to orchestrator.stopAll', async () => {
      mockOrchestrator.stopAll.mockResolvedValue({ llm: { status: 'stopped' } });
      const result = await callHandler('app:stopNovelServices', {});
      expect(mockOrchestrator.stopAll).toHaveBeenCalled();
      expect(result.status).toBe('ok');
      expect(result.data).toEqual({ llm: { status: 'stopped' } });
    });

    it('app:stopNovelServices returns error envelope on failure', async () => {
      mockOrchestrator.stopAll.mockRejectedValue(new Error('stop fail'));
      const result = await callHandler('app:stopNovelServices', {});
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('NOVEL_SERVICES_STOP_ERROR');
    });
  });

  // ── Error propagation for wrapHandler channels ──
  describe('error propagation', () => {
    it('propagates errors from index handlers', async () => {
      mockIndex.getIndex.mockRejectedValue(new Error('disk full'));
      await expect(callHandler('helper:index:get', { novelPath: '/tmp/novel' }))
        .rejects.toThrow('disk full');
    });

    it('propagates errors from chapter handlers', async () => {
      mockIndex.readChapter.mockRejectedValue(new Error('file not found'));
      await expect(callHandler('helper:chapter:read', { novelPath: '/tmp/novel', filename: 'missing.md' }))
        .rejects.toThrow('file not found');
    });

    it('propagates errors from wiki handlers', async () => {
      mockWikiCrud.createWikiPage.mockRejectedValue(new Error('slug exists'));
      await expect(callHandler('helper:wiki:create', { novelPath: '/tmp/novel', title: 'Dup', content: '', tags: [] }))
        .rejects.toThrow('slug exists');
    });

    it('propagates errors from git handlers', async () => {
      mockCommit.commitChapter.mockRejectedValue(new Error('git error'));
      await expect(callHandler('helper:git:commit', { novelPath: '/tmp/novel', filename: 'f.md', content: 'x' }))
        .rejects.toThrow('git error');
    });
  });
});
