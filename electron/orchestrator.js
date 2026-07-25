import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { loadLlmConfig } from './llm-config.js';

export function createOrchestrator(neo4jRuntime, mcpRuntime, llmRuntime, app) {
  let currentNovelPath = null;
  let startupInProgress = false;

  function log(msg) {
    console.log(`[Orchestrator] ${msg}`);
  }

  function logError(msg, err) {
    console.error(`[Orchestrator] ${msg}:`, err?.message || err);
  }

  function killOrphanedNeo4j() {
    try {
      // Find PIDs listening on port 7687 (Neo4j bolt)
      const output = execSync('lsof -ti :7687 -ti :7474 2>/dev/null || true', { encoding: 'utf-8' });
      const pids = [...new Set(output.trim().split('\n').filter(Boolean))];
      if (pids.length === 0) return;
      log(`Killing orphaned Neo4j processes on ports 7687/7474: ${pids.join(', ')}`);
      for (const pid of pids) {
        try { process.kill(Number(pid), 'SIGKILL'); } catch {}
      }
    } catch {}
  }

  async function ingestWikiViaSynapse(mcpRuntime, novelPath, wikiDir, log, logError) {
    let filesIngested = 0;
    let errors = 0;

    // Recursively find all .md files in wiki directory
    async function findMdFiles(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          files.push(...await findMdFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const mdFiles = await findMdFiles(wikiDir);
    log(`Found ${mdFiles.length} wiki files to ingest`);

    for (const filePath of mdFiles) {
      const relPath = path.relative(wikiDir, filePath);
      const slug = relPath.replace(/\.md$/, '').replace(/\\/g, '/');

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.trim()) {
          log(`Skipping empty file: ${relPath}`);
          continue;
        }

        log(`Ingesting: ${relPath}`);
        await mcpRuntime.callTool({
          toolName: 'ingest_text',
          args: { text: content, source: `wiki/${slug}` },
          timeoutMs: 120000,
          retries: 0,
        });
        filesIngested++;
      } catch (err) {
        logError(`Failed to ingest ${relPath}`, err);
        errors++;
      }
    }

    return { status: 'ok', filesIngested, errors, totalFiles: mdFiles.length };
  }

  async function startAll({ novelPath }) {
    if (!novelPath || typeof novelPath !== 'string') {
      throw new Error('novelPath is required');
    }

    if (startupInProgress) {
      log('Startup already in progress, skipping');
      return { status: 'already_starting', novelPath };
    }

    if (currentNovelPath === novelPath) {
      const [neo4jHealth, mcpHealth, llmHealth] = await Promise.all([
        neo4jRuntime.health(),
        mcpRuntime.health(),
        llmRuntime.health(),
      ]);
      log(`Already running for ${novelPath}`);
      return {
        status: 'already_running',
        novelPath,
        neo4j: neo4jHealth,
        mcp: mcpHealth,
        llm: llmHealth,
      };
    }

    startupInProgress = true;
    log(`Starting services for ${novelPath}`);
    const result = {
      status: 'ok',
      novelPath,
      neo4j: { status: 'skipped' },
      mcp: { status: 'skipped' },
      ingest: { status: 'skipped' },
      llm: { status: 'skipped' },
    };

    try {
      // Step 1: Kill existing MCP server
      try {
        const mcpHealth = await mcpRuntime.health();
        if (mcpHealth.status === 'running') {
          log('Step 1: Killing existing MCP server...');
          await mcpRuntime.stop();
          log('MCP stopped');
        } else {
          log('Step 1: No MCP server running — skipping');
        }
        result.mcp = { status: 'killed' };
      } catch (err) {
        logError('MCP kill failed', err);
        result.mcp = { status: 'error', error: err.message };
      }

      // Step 2: Kill existing Neo4j server (both tracked and orphaned)
      try {
        const neo4jHealth = await neo4jRuntime.health();
        if (neo4jHealth.status === 'running') {
          log('Step 2: Killing tracked Neo4j server...');
          await neo4jRuntime.stop();
          log('Neo4j stopped');
        } else {
          log('Step 2: No tracked Neo4j server — skipping');
        }
        killOrphanedNeo4j();
        result.neo4j = { status: 'killed' };
      } catch (err) {
        logError('Neo4j kill failed', err);
        killOrphanedNeo4j();
        result.neo4j = { status: 'error', error: err.message };
      }

      // Step 3: Start Neo4j with per-novel data directory
      try {
        log('Step 3: Starting Neo4j...');
        result.neo4j = await neo4jRuntime.start({ novelPath });
        log(`Neo4j started: pid=${result.neo4j.pid}`);
      } catch (err) {
        logError('Neo4j start failed', err);
        result.neo4j = { status: 'error', error: err.message };
      }

      // Step 4: Start MCP server pointed at Neo4j
      if (result.neo4j.status === 'running') {
        try {
          log('Step 4: Starting MCP server...');
          result.mcp = await mcpRuntime.start({ novelPath });
          log(`MCP started: pid=${result.mcp.pid}, synapse=${result.mcp.usingSynapse}`);
        } catch (err) {
          logError('MCP start failed', err);
          result.mcp = { status: 'error', error: err.message };
        }
      } else {
        log('Step 4: Skipping MCP — Neo4j not running');
      }

      // Step 5: Check wiki data and ingest if needed
      if (result.mcp.status === 'running') {
        try {
          log('Step 5: Checking wiki data...');
          const wikiDir = path.join(novelPath, 'wiki');
          let wikiExists = false;
          try {
            await fs.access(wikiDir);
            wikiExists = true;
          } catch {
            wikiExists = false;
          }

          if (wikiExists) {
            // Check if Neo4j already has data directly via driver (not MCP — avoids bridge overhead)
            let hasData = false;
            try {
              hasData = await neo4jRuntime.hasWikiData();
            } catch (checkErr) {
              log(`Wiki data check failed: ${checkErr.message} — will attempt ingest anyway`);
            }

            if (!hasData) {
              log('Wiki exists but Neo4j is empty — ingesting via Synapse...');
              result.ingest = await ingestWikiViaSynapse(mcpRuntime, novelPath, wikiDir, log, logError);
              log(`Wiki ingest done: ${result.ingest.filesIngested} files, ${result.ingest.errors} errors`);
            } else {
              log('Neo4j already has wiki data — skipping ingest');
              result.ingest = { status: 'skipped', reason: 'already_has_data' };
            }
          } else {
            log('No wiki directory found — skipping ingest');
            result.ingest = { status: 'skipped', reason: 'no_wiki_dir' };
          }
        } catch (err) {
          logError('Wiki ingest check failed', err);
          result.ingest = { status: 'error', error: err.message };
        }
      } else {
        log('Step 5: Skipping wiki check — MCP not running');
      }

      // Step 6: Start LLM (llama-server)
      try {
        log('Step 6: Starting LLM...');
        const llmHealth = await llmRuntime.health();
        if (llmHealth.status === 'running') {
          log('LLM already running');
          result.llm = { status: 'already_running', ...llmHealth };
        } else {
          const config = await loadLlmConfig(app);
          result.llm = await llmRuntime.start(config);
          log(`LLM started: model=${config.modelName}`);
        }
      } catch (err) {
        logError('LLM failed', err);
        result.llm = { status: 'error', error: err.message };
      }

      currentNovelPath = novelPath;
      log('All services started');
      return result;
    } finally {
      startupInProgress = false;
    }
  }

  async function stopAll() {
    log('Stopping all services...');
    const results = { llm: null, mcp: null, neo4j: null };

    // Stop in reverse order: LLM, MCP, Neo4j
    try {
      results.llm = await llmRuntime.stop();
      log('LLM stopped');
    } catch (err) {
      logError('LLM stop failed', err);
      results.llm = { status: 'error', error: err.message };
    }

    try {
      results.mcp = await mcpRuntime.stop();
      log('MCP stopped');
    } catch (err) {
      logError('MCP stop failed', err);
      results.mcp = { status: 'error', error: err.message };
    }

    try {
      results.neo4j = await neo4jRuntime.stop();
      log('Neo4j stopped');
    } catch (err) {
      logError('Neo4j stop failed', err);
      results.neo4j = { status: 'error', error: err.message };
    }

    currentNovelPath = null;
    log('All services stopped');
    return results;
  }

  async function status() {
    const [neo4jHealth, mcpHealth, llmHealth] = await Promise.all([
      neo4jRuntime.health(),
      mcpRuntime.health(),
      llmRuntime.health(),
    ]);

    return {
      currentNovelPath,
      startupInProgress,
      neo4j: neo4jHealth,
      mcp: mcpHealth,
      llm: llmHealth,
    };
  }

  return { startAll, stopAll, status };
}
