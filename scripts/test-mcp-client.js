#!/usr/bin/env node
/**
 * MCP Client Integration Test Script
 * 
 * End-to-end test that validates the full MCP client integration
 * with the Project Synapse server.
 * 
 * Usage:
 *   node scripts/test-mcp-client.js [--novel-path=/path/to/novel]
 * 
 * Prerequisites:
 *   - Project Synapse installed at ~/code/project-synapse-mcp
 *   - Neo4j running on bolt://localhost:7687 (neo4j/neo4j)
 *   - A novel with wiki content at the specified path
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMcpClient } from '../helper/src/mcp/mcp-client.js';
import { McpTransport } from '../helper/src/mcp/mcp-transport.js';
import { createConfig } from '../helper/src/mcp/mcp-config.js';
import { createToolMapper } from '../helper/src/mcp/tool-mapper.js';
import { createArgumentTransformer } from '../helper/src/mcp/argument-transformer.js';
import { createResponseNormalizer } from '../helper/src/mcp/response-normalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IntegrationTest {
  constructor() {
    this.novelPath = null;
    this.synapseProc = null;
    this.mcpClient = null;
    this.transport = null;
    this.toolMapper = null;
    this.argumentTransformer = null;
    this.responseNormalizer = null;
    this.results = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runTest(name, fn) {
    this.log(`Running: ${name}`);
    try {
      await fn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed' });
      this.log(`PASSED: ${name}`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message });
      this.log(`FAILED: ${name} - ${error.message}`, 'error');
    }
  }

  async startSynapseBridge(novelPath) {
    return new Promise((resolve, reject) => {
      if (!process.env.HOME) {
        reject(new Error('HOME environment variable is required to locate the Project Synapse checkout'));
        return;
      }
      const synapsePath = path.join(process.env.HOME, 'code/project-synapse-mcp');
      const bridgePath = path.join(__dirname, '../helper/src/mcp/project-synapse-bridge.js');
      
      if (!process.env.NEO4J_PASSWORD) {
        reject(new Error('NEO4J_PASSWORD environment variable is required'));
        return;
      }

      const env = {
        ...process.env,
        ZUOJIA_NOVEL_PATH: novelPath,
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
      };

      this.synapseProc = spawn('node', [bridgePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      let output = '';
      let errorOutput = '';
      let resolved = false;
      let startupTimer = null;

      const settle = (fn, value) => {
        if (resolved) {
          return;
        }
        resolved = true;
        clearTimeout(startupTimer);
        fn(value);
      };

      const checkReady = () => {
        if (errorOutput.includes('Starting Project Synapse from:') || 
            errorOutput.includes('Initializing Project Synapse server components') ||
            errorOutput.includes('Connected to Neo4j database') ||
            errorOutput.includes('Project Synapse started successfully')) {
          settle(resolve);
          this.log('Synapse server started successfully (via stderr)');
        }
      };

      this.synapseProc.stdout.on('data', (data) => {
        output += data.toString();
        console.log('STDOUT:', data.toString());
        checkReady();
      });

      this.synapseProc.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('STDERR:', data.toString());
        checkReady();
      });

      this.synapseProc.on('error', (err) => {
        settle(reject, new Error(`Failed to start bridge: ${err.message}`));
      });

      this.synapseProc.on('exit', (code) => {
        settle(reject, new Error(`Bridge exited with code ${code}: ${errorOutput}`));
      });

      // Timeout after 30 seconds
      startupTimer = setTimeout(() => {
        settle(reject, new Error(`Synapse bridge startup timeout. Stdout: ${output}. Stderr: ${errorOutput}`));
      }, 30000);
    });
  }

  async initializeMcpClient() {
    this.transport = new McpTransport(this.synapseProc);
    
    // Add debug logging for transport
    this.transport.on('message', (msg) => {
      console.log('TRANSPORT RECV:', JSON.stringify(msg));
    });
    this.transport.on('parseError', (err) => {
      console.log('TRANSPORT PARSE ERROR:', err);
    });
    this.transport.on('close', () => {
      console.log('TRANSPORT CLOSED');
    });
    this.transport.on('error', (err) => {
      console.log('TRANSPORT ERROR:', err);
    });
    
    // Also check raw stdout
    this.synapseProc.stdout.on('data', (data) => {
      console.log('RAW STDOUT:', data.toString());
    });
    
    this.mcpClient = createMcpClient({
      transport: this.transport,
      clientInfo: { name: 'zuojia-test', version: '0.1.0' },
    });

    await this.mcpClient.initialize(30000);
    this.log('MCP client initialized');

    this.toolMapper = createToolMapper();
    this.argumentTransformer = createArgumentTransformer(this.toolMapper);
    this.responseNormalizer = createResponseNormalizer();
  }

  async testToolCall(toolName, args, expectedKeys = []) {
    const synapseTool = this.toolMapper.mapTool(toolName);
    if (!synapseTool) {
      throw new Error(`Tool ${toolName} not mapped to Synapse`);
    }

    const synapseArgs = this.argumentTransformer.transform(toolName, args);
    const result = await this.mcpClient.callTool(synapseTool, synapseArgs);
    const normalized = this.responseNormalizer.normalize(toolName, result);

    if (normalized.status === 'error') {
      throw new Error(`Tool returned error: ${normalized.error?.message}`);
    }

    for (const key of expectedKeys) {
      if (!(key in normalized.data)) {
        throw new Error(`Expected key '${key}' not found in response`);
      }
    }

    return normalized.data;
  }

  async runAllTests() {
    // Parse arguments
    const args = process.argv.slice(2);
    const novelPathArg = args.find(a => a.startsWith('--novel-path='));
    this.novelPath = novelPathArg ? novelPathArg.split('=')[1] : path.join(process.cwd(), 'test-novel');

    this.log('=== MCP Client Integration Test ===');
    this.log(`Novel path: ${this.novelPath}`);

    try {
      // Test 1: Start Synapse Bridge
      await this.runTest('Start Synapse Bridge', async () => {
        await this.startSynapseBridge(this.novelPath);
      });

      // Test 2: Initialize MCP Client
      await this.runTest('Initialize MCP Client', async () => {
        await this.initializeMcpClient();
      });

      // Test 3: List Tools
      await this.runTest('List Available Tools', async () => {
        const tools = this.mcpClient.getTools();
        this.log(`Available tools: ${tools.map(t => t.name).join(', ')}`);
        if (tools.length === 0) {
          throw new Error('No tools available from Synapse');
        }
      });

      // Test 4: Call wiki_list_pages
      await this.runTest('Call wiki_list_pages', async () => {
        const data = await this.testToolCall('wiki_list_pages', { limit: 10 }, ['pages']);
        this.log(`Found ${data.pages?.length || 0} pages`);
      });

      // Test 5: Call wiki_search
      await this.runTest('Call wiki_search', async () => {
        const data = await this.testToolCall('wiki_search', { query: 'character', limit: 5 }, ['results']);
        this.log(`Found ${data.results?.length || 0} search results`);
      });

      // Test 6: Call wiki_get_page (if pages exist)
      await this.runTest('Call wiki_get_page (first page)', async () => {
        const listData = await this.testToolCall('wiki_list_pages', { limit: 1 });
        if (listData.pages && listData.pages.length > 0) {
          const page = listData.pages[0];
          const data = await this.testToolCall('wiki_get_page', { slug: page.slug }, ['content', 'title']);
          this.log(`Read page: ${data.title}`);
        } else {
          this.log('No pages to test wiki_get_page, skipping', 'info');
        }
      });

      // Test 7: Call wiki_neo4j_search
      await this.runTest('Call wiki_neo4j_search', async () => {
        const data = await this.testToolCall('wiki_neo4j_search', { query: 'character', limit: 5 }, ['results']);
        this.log(`Neo4j search returned ${data.results?.length || 0} results`);
      });

      // Test 8: Call wiki_neo4j_get_related
      await this.runTest('Call wiki_neo4j_get_related', async () => {
        const listData = await this.testToolCall('wiki_list_pages', { limit: 1 });
        if (listData.pages && listData.pages.length > 0) {
          const page = listData.pages[0];
          const data = await this.testToolCall('wiki_neo4j_get_related', { slug: page.slug, depth: 2 }, ['content', 'structuredContent']);
          // The explore_connections tool returns content with text and structuredContent
          const hasResults = data.content?.[0]?.text || data.structuredContent?.result;
          this.log(`Related pages found: ${!!hasResults}`);
        } else {
          this.log('No pages to test wiki_neo4j_get_related, skipping', 'info');
        }
      });

      // Test 9: Tool Mapping Verification
      await this.runTest('Tool Mapping Verification', async () => {
        const mapped = [];
        const unmapped = [];
        
        for (const zuojiaTool of [
          'wiki_list_pages', 'wiki_get_page', 'wiki_search', 
          'wiki_get_backlinks', 'wiki_build_graph', 'wiki_traverse_graph',
          'wiki_neo4j_search', 'wiki_neo4j_get_related', 'wiki_neo4j_find_paths', 'wiki_neo4j_query'
        ]) {
          const mappedTool = this.toolMapper.mapTool(zuojiaTool);
          if (mappedTool) {
            mapped.push(`${zuojiaTool} → ${mappedTool}`);
          } else {
            unmapped.push(zuojiaTool);
          }
        }

        this.log('Mapped tools:', 'info');
        mapped.forEach(m => this.log(`  ${m}`, 'info'));
        
        if (unmapped.length > 0) {
          this.log('Unmapped tools (will use fallback):', 'info');
          unmapped.forEach(u => this.log(`  ${u}`, 'info'));
        }
      });

      // Test 10: Shutdown (Synapse doesn't support shutdown, just destroy transport)
      await this.runTest('Graceful Shutdown', async () => {
        try {
          await this.mcpClient.shutdown();
        } catch (e) {
          // Synapse doesn't support shutdown, that's OK
        }
        this.transport.destroy();
      });

    } finally {
      if (this.synapseProc) {
        this.synapseProc.kill('SIGTERM');
      }
    }

    // Print summary
    this.log('\n=== Test Summary ===');
    this.log(`Passed: ${this.results.passed}`);
    this.log(`Failed: ${this.results.failed}`);
    this.log(`Total:  ${this.results.passed + this.results.failed}`);

    if (this.results.failed > 0) {
      this.log('\nFailed tests:', 'error');
      this.results.tests.filter(t => t.status === 'failed').forEach(t => {
        this.log(`  - ${t.name}: ${t.error}`, 'error');
      });
      process.exit(1);
    } else {
      this.log('\nAll tests passed! 🎉', 'success');
      process.exit(0);
    }
  }
}

// Run the test
const test = new IntegrationTest();
test.runAllTests().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});