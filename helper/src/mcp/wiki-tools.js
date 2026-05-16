import fs from 'fs/promises';
import path from 'path';
import { listWikiPages } from '../wiki/list-pages.js';
import { readWikiPage } from '../wiki/crud.js';

function normalizeSlugSegment(segment) {
  return segment
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[-\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeWikiSlug(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value
    .split('/')
    .map((segment) => normalizeSlugSegment(segment))
    .filter(Boolean)
    .join('/');
}

function extractWikiLinks(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const links = [];
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

  for (const match of content.matchAll(linkRegex)) {
    const target = normalizeWikiSlug((match[1] || '').trim());
    if (target) {
      links.push(target);
    }
  }

  return links;
}

async function listMarkdownFiles(rootDir) {
  try {
    const entries = await fs.readdir(rootDir, { recursive: true });
    return entries
      .filter((entry) => entry.endsWith('.md'))
      .filter((entry) => entry.split(path.sep).every((segment) => !segment.startsWith('.')))
      .map((entry) => path.join(rootDir, entry));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readFileSafely(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export async function listWikiPagesForMcp(novelPath, limit = 200) {
  const response = await listWikiPages(novelPath);
  if (response.status !== 'ok') {
    return response;
  }

  return {
    status: 'ok',
    data: {
      pages: response.data.pages.slice(0, limit),
      total: response.data.pages.length,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function getWikiPageForMcp(novelPath, slug) {
  const normalizedSlug = normalizeWikiSlug(slug);
  const response = await readWikiPage(novelPath, normalizedSlug);

  if (response.status !== 'ok') {
    return response;
  }

  return {
    status: 'ok',
    data: {
      slug: normalizedSlug,
      content: response.data.content,
      tags: response.data.tags,
      title: response.data.title,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function searchWikiPagesForMcp(novelPath, query, limit = 10) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return {
      status: 'ok',
      data: {
        query,
        results: [],
      },
      timestamp: new Date().toISOString(),
    };
  }

  const listed = await listWikiPages(novelPath);
  if (listed.status !== 'ok') {
    return listed;
  }

  const results = [];
  for (const page of listed.data.pages) {
    if (results.length >= limit) {
      break;
    }

    const readResult = await readWikiPage(novelPath, page.slug);
    const haystack = `${page.title}\n${readResult.status === 'ok' ? readResult.data.content : ''}`.toLowerCase();

    if (haystack.includes(q)) {
      results.push({
        slug: page.slug,
        title: page.title,
        tags: page.tags,
        snippet: (readResult.status === 'ok' ? readResult.data.content : '').slice(0, 240),
      });
    }
  }

  return {
    status: 'ok',
    data: {
      query,
      results,
      count: results.length,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function getWikiBacklinksForMcp(novelPath, slug, limit = 200) {
  const normalizedTarget = normalizeWikiSlug(slug);
  const wikiRoot = path.join(novelPath, 'wiki');
  const manuscriptRoot = path.join(novelPath, 'manuscript');

  const [wikiFiles, manuscriptFiles] = await Promise.all([
    listMarkdownFiles(wikiRoot),
    listMarkdownFiles(manuscriptRoot),
  ]);

  const references = [];
  const scanFile = async (filePath, sourceType, sourceRoot) => {
    const content = await readFileSafely(filePath);
    const links = extractWikiLinks(content);

    if (!links.includes(normalizedTarget)) {
      return;
    }

    references.push({
      sourceType,
      source: path.relative(sourceRoot, filePath).replace(/\\/g, '/'),
    });
  };

  for (const filePath of wikiFiles) {
    if (references.length >= limit) break;
    await scanFile(filePath, 'wiki', wikiRoot);
  }

  for (const filePath of manuscriptFiles) {
    if (references.length >= limit) break;
    await scanFile(filePath, 'manuscript', manuscriptRoot);
  }

  return {
    status: 'ok',
    data: {
      slug: normalizedTarget,
      references,
      count: references.length,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function buildWikiKnowledgeGraphForMcp(novelPath, maxEdges = 500) {
  const listed = await listWikiPages(novelPath);
  if (listed.status !== 'ok') {
    return listed;
  }

  const nodes = listed.data.pages.map((page) => ({
    id: page.slug,
    label: page.title,
    tags: page.tags,
  }));

  const slugSet = new Set(nodes.map((node) => node.id));
  const edges = [];

  for (const page of listed.data.pages) {
    if (edges.length >= maxEdges) {
      break;
    }

    const pageResult = await readWikiPage(novelPath, page.slug);
    if (pageResult.status !== 'ok') {
      continue;
    }

    const outbound = new Set(extractWikiLinks(pageResult.data.content));
    for (const target of outbound) {
      if (edges.length >= maxEdges) {
        break;
      }

      if (!slugSet.has(target)) {
        continue;
      }

      edges.push({
        from: page.slug,
        to: target,
        relation: 'wiki_link',
      });
    }
  }

  return {
    status: 'ok',
    data: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
    },
    timestamp: new Date().toISOString(),
  };
}

export { normalizeWikiSlug, extractWikiLinks };
