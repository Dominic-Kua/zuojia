import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import neo4j from 'neo4j-driver';
import { buildWikiKnowledgeGraphForMcp } from '../helper/src/mcp/wiki-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createNeo4jRuntimeManager({
  spawnFn = spawn,
  nowFn = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  maxLogs = 200,
} = {}) {
  let processRef = null;
  let startTime = null;
  let runtimeNovelPath = null;
  let databaseName = 'wiki';
  let driver = null;
  let lastError = null;
  const callLogs = [];

  function pushLog(entry) {
    callLogs.push(entry);
    if (callLogs.length > maxLogs) {
      callLogs.splice(0, callLogs.length - maxLogs);
    }
  }

  function isRunningProcess(proc) {
    return Boolean(proc) && proc.exitCode === null;
  }

  function getNeo4jDataPath(novelPath) {
    return path.join(novelPath, '.zuojia', 'neo4j-data');
  }

  function getNeo4jConfigPath(novelPath) {
    return path.join(novelPath, '.zuojia', 'neo4j.conf');
  }

  async function writeNeo4jConfig(novelPath) {
    const configPath = getNeo4jConfigPath(novelPath);
    const dataPath = getNeo4jDataPath(novelPath);
    
    const config = `# Neo4j configuration for ${path.basename(novelPath)}
dbms.memory.heap.initial_size=512m
dbms.memory.heap.max_size=1g
dbms.memory.pagecache.size=512m
dbms.directories.data=${dataPath}
dbms.default_database=${databaseName}
dbms.security.auth_enabled=false
dbms.connector.bolt.listen_address=:7687
dbms.connector.http.listen_address=:7474
dbms.connector.https.enabled=false
dbms.logs.default=INFO
server.directories.import=${path.join(novelPath, 'wiki')}
`;
    
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, config, 'utf-8');
  }

  async function start({ novelPath, dbName = 'wiki' }) {
    if (!novelPath || typeof novelPath !== 'string') {
      throw new Error('novelPath is required to start Neo4j runtime');
    }

    databaseName = dbName;

    // Check if Neo4j is already running for this novel
    if (isRunningProcess(processRef) && runtimeNovelPath === novelPath) {
      return {
        status: 'running',
        pid: processRef.pid,
        novelPath: runtimeNovelPath,
        databaseName,
        startedAt: new Date(startTime).toISOString(),
      };
    }

    // Stop any running Neo4j process for different novel
    if (isRunningProcess(processRef) && runtimeNovelPath !== novelPath) {
      await stop();
    }

    // Write Neo4j configuration
    await writeNeo4jConfig(novelPath);

    const dataPath = getNeo4jDataPath(novelPath);
    const configPath = getNeo4jConfigPath(novelPath);

    // Ensure data directory exists
    await fs.mkdir(dataPath, { recursive: true });

    // Start Neo4j process
    const child = spawnFn('neo4j', [
      'console',
      '--config-dir',
      path.dirname(configPath),
      '--data-dir',
      dataPath,
      '--home',
      dataPath,
    ], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NEO4J_CONF: path.dirname(configPath),
        NEO4J_HOME: dataPath,
      },
    });

    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Started.')) {
        pushLog({
          timestamp: new Date().toISOString(),
          type: 'neo4j_startup',
          message: 'Neo4j database started successfully',
        });
      }
    });

    child.stderr.on('data', (data) => {
      const error = data.toString();
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'neo4j_error',
        message: error.trim(),
        level: 'error',
      });
      lastError = error.trim();
    });

    child.on('error', (error) => {
      lastError = error.message;
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'neo4j_process_error',
        message: error.message,
        level: 'error',
      });
    });

    child.on('exit', (code, signal) => {
      if (processRef !== child) {
        return;
      }
      if (code !== 0) {
        lastError = `Neo4j exited with code ${code} signal ${signal || 'none'}`;
        pushLog({
          timestamp: new Date().toISOString(),
          type: 'neo4j_exit',
          message: lastError,
          level: 'error',
        });
      }
      processRef = null;
      runtimeNovelPath = null;
      startTime = null;
      if (driver) {
        driver.close().catch(() => {});
        driver = null;
      }
    });

    processRef = child;
    runtimeNovelPath = novelPath;
    startTime = nowFn();
    lastError = null;

    // Wait for Neo4j to be ready (max 30 seconds)
    const maxWaitTime = 30000;
    const startWait = nowFn();
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        if (!isRunningProcess(processRef)) {
          clearInterval(checkInterval);
          reject(new Error('Neo4j process terminated unexpectedly'));
          return;
        }

        if (nowFn() - startWait > maxWaitTime) {
          clearInterval(checkInterval);
          reject(new Error('Neo4j startup timed out'));
          return;
        }

        try {
          // Try to connect to Neo4j
          if (!driver) {
            driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'neo4j'));
          }
          
          const serverInfo = await driver.getServerInfo();
          clearInterval(checkInterval);
          
          pushLog({
            timestamp: new Date().toISOString(),
            type: 'neo4j_connected',
            message: `Connected to Neo4j ${serverInfo.version}`,
          });

          resolve({
            status: 'running',
            pid: child.pid,
            novelPath,
            databaseName,
            startedAt: new Date(startTime).toISOString(),
            serverInfo,
          });
        } catch (err) {
          // Not ready yet, continue waiting
          pushLog({
            timestamp: new Date().toISOString(),
            type: 'neo4j_connection_attempt',
            message: `Waiting for Neo4j: ${err.message}`,
            level: 'info',
          });
        }
      }, 1000);
    });
  }

  async function stop() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        alreadyStopped: true,
      };
    }

    const child = processRef;
    let resolveExit;
    const waitForExit = new Promise((resolve) => {
      resolveExit = resolve;
      child.once('exit', resolve);
      if (child.exitCode !== null) {
        resolve();
      }
    });

    try {
      child.kill('SIGTERM');
    } catch {
      // Ignore kill errors and continue waiting for exit.
    }

    const timeout = setTimeoutFn(() => {
      if (child.exitCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill errors.
        }
        setTimeoutFn(() => resolveExit(), 2000);
      }
    }, 5000);

    await waitForExit;
    clearTimeoutFn(timeout);

    if (processRef === child) {
      processRef = null;
      runtimeNovelPath = null;
      startTime = null;
    }

    if (driver) {
      await driver.close();
      driver = null;
    }

    return {
      status: 'stopped',
      alreadyStopped: false,
    };
  }

  async function health() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        pid: null,
        novelPath: null,
        databaseName: null,
        uptimeMs: 0,
        lastError,
      };
    }

    let serverInfo = null;
    try {
      if (!driver) {
        driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'neo4j'));
      }
      serverInfo = await driver.getServerInfo();
    } catch (err) {
      lastError = err.message;
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'neo4j_health_check_failed',
        message: err.message,
        level: 'error',
      });
    }

    return {
      status: serverInfo ? 'running' : 'error',
      pid: processRef.pid,
      novelPath: runtimeNovelPath,
      databaseName,
      uptimeMs: startTime ? Math.max(0, nowFn() - startTime) : 0,
      lastError,
      serverInfo,
    };
  }

  async function importWikiData() {
    if (!isRunningProcess(processRef) || !runtimeNovelPath || !driver) {
      throw new Error('Neo4j runtime is not running');
    }

    try {
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'neo4j_import_start',
        message: 'Starting wiki data import',
      });

      // Get wiki graph data using existing wiki-tools
      const graphResult = await buildWikiKnowledgeGraphForMcp(runtimeNovelPath, 5000);
      
      if (graphResult.status !== 'ok') {
        throw new Error(`Failed to build wiki graph: ${graphResult.error?.message || 'Unknown error'}`);
      }

      const { nodes, edges } = graphResult.data;

      const session = driver.session();

      try {
        // Clear existing data
        await session.run(`
          MATCH (n)
          WHERE n:WikiPage OR n:ManuscriptPage
          DETACH DELETE n
        `);

        // Import nodes
        for (const node of nodes) {
          await session.run(
            `CREATE (p:WikiPage {
              id: $id,
              title: $title,
              tags: $tags,
              createdAt: datetime()
            })`,
            {
              id: node.id,
              title: node.label || node.id,
              tags: node.tags || [],
            }
          );
        }

        // Import edges
        for (const edge of edges) {
          await session.run(
            `MATCH (from:WikiPage {id: $from})
             MATCH (to:WikiPage {id: $to})
             CREATE (from)-[:LINKS_TO {
               relation: $relation,
               sourcePage: $sourcePage,
               textSpan: $textSpan,
               createdAt: datetime()
             }]->(to)`,
            {
              from: edge.from,
              to: edge.to,
              relation: edge.relation,
              sourcePage: edge.evidence?.sourcePage || edge.from,
              textSpan: edge.evidence?.textSpan || `[[${edge.to}]]`,
            }
          );
        }

        pushLog({
          timestamp: new Date().toISOString(),
          type: 'neo4j_import_complete',
          message: `Imported ${nodes.length} nodes and ${edges.length} edges`,
        });

        return {
          status: 'ok',
          nodesImported: nodes.length,
          edgesImported: edges.length,
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'neo4j_import_error',
        message: error.message,
        level: 'error',
      });
      lastError = error.message;
      throw error;
    }
  }

  async function queryCypher(query, params = {}) {
    if (!isRunningProcess(processRef) || !runtimeNovelPath || !driver) {
      throw new Error('Neo4j runtime is not running');
    }

    const startedAt = nowFn();
    const session = driver.session();

    try {
      const result = await session.run(query, params);
      const records = result.records.map(record => record.toObject());
      
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'neo4j_query',
        query,
        params,
        durationMs: Math.max(0, nowFn() - startedAt),
        recordsCount: records.length,
      });

      return {
        status: 'ok',
        data: records,
        summary: result.summary,
      };
    } catch (error) {
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'neo4j_query_error',
        query,
        params,
        error: error.message,
        level: 'error',
      });
      lastError = error.message;
      throw error;
    } finally {
      await session.close();
    }
  }

  async function naturalLanguageSearch(query, limit = 10) {
    if (!isRunningProcess(processRef) || !runtimeNovelPath || !driver) {
      throw new Error('Neo4j runtime is not running');
    }

    // Simple keyword-based search for Neo4j
    // In a real implementation, this would use Synapse's natural language capabilities
    const session = driver.session();
    
    try {
      const result = await session.run(
        `MATCH (p:WikiPage)
         WHERE p.id CONTAINS $query 
            OR p.title CONTAINS $query 
            OR ANY(tag IN p.tags WHERE tag CONTAINS $query)
         RETURN p.id AS slug, p.title AS title, p.tags AS tags
         LIMIT $limit`,
        {
          query: query.toLowerCase(),
          limit: Math.min(limit, 100),
        }
      );

      const records = result.records.map(record => ({
        slug: record.get('slug'),
        title: record.get('title'),
        tags: record.get('tags'),
        score: 1.0, // Simple scoring
      }));

      return {
        status: 'ok',
        data: {
          query,
          results: records,
          count: records.length,
        },
      };
    } finally {
      await session.close();
    }
  }

  function getLogs({ limit = 50 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 50), 500));
    return callLogs.slice(-safeLimit);
  }

  return {
    start,
    stop,
    health,
    importWikiData,
    queryCypher,
    naturalLanguageSearch,
    getLogs,
  };
}