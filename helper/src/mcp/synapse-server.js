#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import neo4j from 'neo4j-driver';
import {
  listWikiPagesForMcp,
  getWikiPageForMcp,
  searchWikiPagesForMcp,
  getWikiBacklinksForMcp,
  buildWikiKnowledgeGraphForMcp,
  traverseWikiKnowledgeGraphForMcp,
} from './wiki-tools.js';
import { NEO4J_BOLT_URI, NEO4J_USERNAME, NEO4J_PASSWORD as NEO4J_DEFAULT_PASSWORD } from '../../../electron/neo4j-defaults.js';

const novelPath = process.env.ZUOJIA_NOVEL_PATH;
const NEO4J_URI = process.env.NEO4J_URI || NEO4J_BOLT_URI;
const NEO4J_USER = process.env.NEO4J_USER || NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || NEO4J_DEFAULT_PASSWORD;

if (!novelPath) {
  console.error('Missing required env var: ZUOJIA_NOVEL_PATH');
  process.exit(1);
}

let driver = null;

async function getDriver() {
  if (!driver) {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    try {
      await driver.verifyConnectivity();
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error.message);
      driver = null;
      throw new Error(`Neo4j connection failed: ${error.message}`);
    }
  }
  return driver;
}

function toText(result) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

function logServerError(code, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({
    code,
    message,
    timestamp: new Date().toISOString(),
  }));
}

async function executeNeo4jQuery(query, params = {}) {
  const driver = await getDriver();
  const session = driver.session();
  
  try {
    const result = await session.run(query, params);
    const records = result.records.map(record => record.toObject());
    return {
      status: 'ok',
      data: {
        records,
        summary: {
          counters: result.summary.counters,
          queryType: result.summary.queryType,
          resultAvailableAfter: result.summary.resultAvailableAfter,
          resultConsumedAfter: result.summary.resultConsumedAfter,
        },
      },
      timestamp: new Date().toISOString(),
    };
  } finally {
    await session.close();
  }
}

async function neo4jNaturalLanguageSearch(query, limit = 10) {
  const driver = await getDriver();
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH (p:WikiPage)
       WHERE p.id CONTAINS $query 
          OR p.title CONTAINS $query 
          OR ANY(tag IN p.tags WHERE tag CONTAINS $query)
       RETURN p.id AS slug, p.title AS title, p.tags AS tags, 1.0 AS score
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
      score: record.get('score'),
    }));

    return {
      status: 'ok',
      data: {
        query,
        results: records,
        count: records.length,
      },
      timestamp: new Date().toISOString(),
    };
  } finally {
    await session.close();
  }
}

async function neo4jGetRelatedPages(slug, depth = 2, limit = 20) {
  const driver = await getDriver();
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH path = (start:WikiPage {id: $slug})-[*1..$depth]-(related:WikiPage)
       WHERE start <> related
       RETURN DISTINCT related.id AS slug, related.title AS title, 
              length(path) AS distance
       ORDER BY distance
       LIMIT $limit`,
      {
        slug,
        depth: Math.min(depth, 5),
        limit: Math.min(limit, 100),
      }
    );

    const records = result.records.map(record => ({
      slug: record.get('slug'),
      title: record.get('title'),
      distance: record.get('distance').toNumber(),
    }));

    return {
      status: 'ok',
      data: {
        startSlug: slug,
        related: records,
        count: records.length,
      },
      timestamp: new Date().toISOString(),
    };
  } finally {
    await session.close();
  }
}

async function neo4jFindPaths(startSlug, targetSlug, maxDepth = 3) {
  const driver = await getDriver();
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH path = shortestPath(
        (start:WikiPage {id: $startSlug})-[*1..$maxDepth]-(target:WikiPage {id: $targetSlug})
       )
       RETURN [node IN nodes(path) | node.id] AS path,
              [rel IN relationships(path) | {
                from: startNode(rel).id,
                to: endNode(rel).id,
                relation: rel.relation
              }] AS relationships`,
      {
        startSlug,
        targetSlug,
        maxDepth: Math.min(maxDepth, 10),
      }
    );

    if (result.records.length === 0) {
      return {
        status: 'ok',
        data: {
          startSlug,
          targetSlug,
          pathFound: false,
          path: [],
          relationships: [],
        },
        timestamp: new Date().toISOString(),
      };
    }

    const record = result.records[0];
    const path = record.get('path');
    const relationships = record.get('relationships');

    return {
      status: 'ok',
      data: {
        startSlug,
        targetSlug,
        pathFound: true,
        path,
        relationships,
        distance: path.length - 1,
      },
      timestamp: new Date().toISOString(),
    };
  } finally {
    await session.close();
  }
}

const server = new Server(
  {
    name: 'zuojia-synapse-mcp',
    version: '0.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Existing wiki tools for compatibility
      {
        name: 'wiki_list_pages',
        description: 'List wiki pages and metadata for the current novel.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 1000, default: 200 },
          },
        },
      },
      {
        name: 'wiki_get_page',
        description: 'Read one wiki page by slug.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
          },
          required: ['slug'],
        },
      },
      {
        name: 'wiki_search',
        description: 'Search wiki pages by title/content substring match.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
          },
          required: ['query'],
        },
      },
      {
        name: 'wiki_get_backlinks',
        description: 'Find wiki/manuscript files that link to a wiki page.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 5000, default: 200 },
          },
          required: ['slug'],
        },
      },
      {
        name: 'wiki_build_graph',
        description: 'Build a lightweight knowledge graph from internal wiki links.',
        inputSchema: {
          type: 'object',
          properties: {
            maxEdges: { type: 'number', minimum: 1, maximum: 10000, default: 500 },
          },
        },
      },
      {
        name: 'wiki_traverse_graph',
        description: 'Traverse graph relationships between two wiki nodes and return shortest path.',
        inputSchema: {
          type: 'object',
          properties: {
            startSlug: { type: 'string' },
            targetSlug: { type: 'string' },
            maxDepth: { type: 'number', minimum: 1, maximum: 8, default: 3 },
            maxEdges: { type: 'number', minimum: 1, maximum: 10000, default: 2000 },
          },
          required: ['startSlug', 'targetSlug'],
        },
      },
      // Neo4j/Synapse enhanced tools
      {
        name: 'wiki_neo4j_search',
        description: 'Search wiki pages using Neo4j graph database with natural language query.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
          },
          required: ['query'],
        },
      },
      {
        name: 'wiki_neo4j_get_related',
        description: 'Get wiki pages related to a given page via graph connections.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            depth: { type: 'number', minimum: 1, maximum: 5, default: 2 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          },
          required: ['slug'],
        },
      },
      {
        name: 'wiki_neo4j_find_paths',
        description: 'Find shortest path between two wiki pages in the knowledge graph.',
        inputSchema: {
          type: 'object',
          properties: {
            startSlug: { type: 'string' },
            targetSlug: { type: 'string' },
            maxDepth: { type: 'number', minimum: 1, maximum: 10, default: 3 },
          },
          required: ['startSlug', 'targetSlug'],
        },
      },
      {
        name: 'wiki_neo4j_query',
        description: 'Execute a Cypher query against the Neo4j knowledge graph.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            params: { type: 'object', default: {} },
          },
          required: ['query'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments || {};

  // Existing wiki tools
  if (name === 'wiki_list_pages') {
    return toText(await listWikiPagesForMcp(novelPath, Number(args.limit || 200)));
  }

  if (name === 'wiki_get_page') {
    return toText(await getWikiPageForMcp(novelPath, String(args.slug || '')));
  }

  if (name === 'wiki_search') {
    return toText(
      await searchWikiPagesForMcp(novelPath, String(args.query || ''), Number(args.limit || 10))
    );
  }

  if (name === 'wiki_get_backlinks') {
    return toText(
      await getWikiBacklinksForMcp(novelPath, String(args.slug || ''), Number(args.limit || 200))
    );
  }

  if (name === 'wiki_build_graph') {
    return toText(await buildWikiKnowledgeGraphForMcp(novelPath, Number(args.maxEdges || 500)));
  }

  if (name === 'wiki_traverse_graph') {
    return toText(
      await traverseWikiKnowledgeGraphForMcp(novelPath, {
        startSlug: String(args.startSlug || ''),
        targetSlug: String(args.targetSlug || ''),
        maxDepth: Number(args.maxDepth || 3),
        maxEdges: Number(args.maxEdges || 2000),
      })
    );
  }

  // Neo4j enhanced tools
  if (name === 'wiki_neo4j_search') {
    try {
      return toText(await neo4jNaturalLanguageSearch(String(args.query || ''), Number(args.limit || 10)));
    } catch (error) {
      return toText({
        status: 'error',
        error: {
          code: 'NEO4J_UNAVAILABLE',
          message: `Neo4j search failed: ${error.message}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (name === 'wiki_neo4j_get_related') {
    try {
      return toText(await neo4jGetRelatedPages(
        String(args.slug || ''),
        Number(args.depth || 2),
        Number(args.limit || 20)
      ));
    } catch (error) {
      return toText({
        status: 'error',
        error: {
          code: 'NEO4J_UNAVAILABLE',
          message: `Failed to get related pages: ${error.message}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (name === 'wiki_neo4j_find_paths') {
    try {
      return toText(await neo4jFindPaths(
        String(args.startSlug || ''),
        String(args.targetSlug || ''),
        Number(args.maxDepth || 3)
      ));
    } catch (error) {
      return toText({
        status: 'error',
        error: {
          code: 'NEO4J_UNAVAILABLE',
          message: `Failed to find paths: ${error.message}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (name === 'wiki_neo4j_query') {
    try {
      return toText(await executeNeo4jQuery(String(args.query || ''), args.params || {}));
    } catch (error) {
      return toText({
        status: 'error',
        error: {
          code: 'NEO4J_UNAVAILABLE',
          message: `Cypher query failed: ${error.message}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return toText({
    status: 'error',
    error: {
      code: 'UNKNOWN_TOOL',
      message: `Unknown tool: ${name}`,
    },
    timestamp: new Date().toISOString(),
  });
});

const transport = new StdioServerTransport();

process.on('uncaughtException', (error) => {
  logServerError('MCP_SERVER_UNCAUGHT_EXCEPTION', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logServerError('MCP_SERVER_UNHANDLED_REJECTION', error);
  process.exit(1);
});

try {
  await server.connect(transport);
} catch (error) {
  logServerError('MCP_SERVER_CONNECT_FAILED', error);
  process.exit(1);
}