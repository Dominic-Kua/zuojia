// @vitest-environment node
import { describe, it, expect } from 'vitest';

describe('electron module wiring smoke tests', () => {
  it('find-neo4j exports findNeo4jHome', async () => {
    const mod = await import('../../electron/find-neo4j.js');
    expect(typeof mod.findNeo4jHome).toBe('function');
  });

  it('find-java exports findJavaHome', async () => {
    const mod = await import('../../electron/find-java.js');
    expect(typeof mod.findJavaHome).toBe('function');
  });

  it('neo4j-defaults exports expected constants', async () => {
    const mod = await import('../../electron/neo4j-defaults.js');
    expect(mod.NEO4J_BOLT_URI).toContain('bolt://');
    expect(typeof mod.NEO4J_USERNAME).toBe('string');
    expect(typeof mod.NEO4J_PASSWORD).toBe('string');
  });

  it('llm-defaults exports expected config', async () => {
    const mod = await import('../../electron/llm-defaults.js');
    expect(typeof mod.LLM_EXECUTABLE_PATH).toBe('string');
    expect(typeof mod.LLM_PORT).toBe('number');
    expect(typeof mod.LLM_MODEL_NAME).toBe('string');
  });

  it('constants exports timeout values', async () => {
    const mod = await import('../../electron/constants.js');
    expect(typeof mod.SIGTERM_TO_SIGKILL_MS).toBe('number');
    expect(typeof mod.NEO4J_STARTUP_TIMEOUT_MS).toBe('number');
    expect(typeof mod.TOOL_CALL_TIMEOUT_MS).toBe('number');
  });

  it('platform-paths exports PATH_ENRICHMENT', async () => {
    const mod = await import('../../electron/platform-paths.js');
    expect(Array.isArray(mod.PATH_ENRICHMENT)).toBe(true);
    expect(mod.PATH_ENRICHMENT.length).toBeGreaterThan(0);
  });

  it('neo4j-runtime exports createNeo4jRuntimeManager', async () => {
    const mod = await import('../../electron/neo4j-runtime.js');
    expect(typeof mod.createNeo4jRuntimeManager).toBe('function');
  });

  it('mcp-runtime exports createMcpRuntimeManager', async () => {
    const mod = await import('../../electron/mcp-runtime.js');
    expect(typeof mod.createMcpRuntimeManager).toBe('function');
  });

  it('llm-runtime exports createLlmRuntimeManager', async () => {
    const mod = await import('../../electron/llm-runtime.js');
    expect(typeof mod.createLlmRuntimeManager).toBe('function');
  });

  it('orchestrator exports createOrchestrator', async () => {
    const mod = await import('../../electron/orchestrator.js');
    expect(typeof mod.createOrchestrator).toBe('function');
  });

  it('ipc-handlers exports registerHandlers', async () => {
    const mod = await import('../../electron/ipc-handlers.js');
    expect(typeof mod.registerHandlers).toBe('function');
  });

  it('llm-config exports loadLlmConfig', async () => {
    const mod = await import('../../electron/llm-config.js');
    expect(typeof mod.loadLlmConfig).toBe('function');
  });

  it('mcp-config exports createConfig', async () => {
    const mod = await import('../../helper/src/mcp/mcp-config.js');
    expect(typeof mod.createConfig).toBe('function');
    const config = mod.createConfig();
    expect(config.synapse).toBeDefined();
    expect(config.mcpClient).toBeDefined();
    expect(config.logging).toBeDefined();
  });

  it('mcp-client exports createMcpClient', async () => {
    const mod = await import('../../helper/src/mcp/mcp-client.js');
    expect(typeof mod.createMcpClient).toBe('function');
  });

  it('wiki-tools exports all expected functions', async () => {
    const mod = await import('../../helper/src/mcp/wiki-tools.js');
    expect(typeof mod.listWikiPagesForMcp).toBe('function');
    expect(typeof mod.getWikiPageForMcp).toBe('function');
    expect(typeof mod.searchWikiPagesForMcp).toBe('function');
    expect(typeof mod.getWikiBacklinksForMcp).toBe('function');
    expect(typeof mod.buildWikiKnowledgeGraphForMcp).toBe('function');
  });

  it('tool-mapper exports createToolMapper', async () => {
    const mod = await import('../../helper/src/mcp/tool-mapper.js');
    expect(typeof mod.createToolMapper).toBe('function');
  });

});
