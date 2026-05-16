#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  listWikiPagesForMcp,
  getWikiPageForMcp,
  searchWikiPagesForMcp,
  getWikiBacklinksForMcp,
  buildWikiKnowledgeGraphForMcp,
} from './wiki-tools.js';

const novelPath = process.env.ZUOJIA_NOVEL_PATH;

if (!novelPath) {
  console.error('Missing required env var: ZUOJIA_NOVEL_PATH');
  process.exit(1);
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

const server = new Server(
  {
    name: 'zuojia-wiki-mcp',
    version: '0.1.0',
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
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments || {};

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
await server.connect(transport);
