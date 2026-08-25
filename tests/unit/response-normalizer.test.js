import { describe, it, expect, beforeEach } from 'vitest';
import { createResponseNormalizer } from '../../helper/src/mcp/response-normalizer.js';

describe('ResponseNormalizer', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = createResponseNormalizer();
  });

  describe('wiki_list_pages', () => {
    it('should normalize list of pages', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'page1.md\npage2.md\npage3.md' }],
      };

      const result = normalizer.normalize('wiki_list_pages', synapseResult);

      expect(result.status).toBe('ok');
      expect(result.data.pages).toHaveLength(3);
      expect(result.data.pages[0]).toEqual({ slug: 'page1.md', title: 'page1.md', path: 'page1.md' });
    });

    it('should handle pipe-separated structured output', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'chapter-1 | Chapter 1 | chapters/chapter-1.md\ncharacter-bob | Bob the Character | characters/bob.md' }],
      };

      const result = normalizer.normalize('wiki_list_pages', synapseResult);

      expect(result.data.pages).toHaveLength(2);
      expect(result.data.pages[0]).toEqual({
        slug: 'chapter-1',
        title: 'Chapter 1',
        path: 'chapters/chapter-1.md',
      });
    });

    it('should handle empty result', () => {
      const synapseResult = { content: [{ type: 'text', text: '' }] };
      const result = normalizer.normalize('wiki_list_pages', synapseResult);
      expect(result.data.pages).toEqual([]);
    });
  });

  describe('wiki_get_page', () => {
    it('should extract content and title from markdown', () => {
      const synapseResult = {
        content: [{ type: 'text', text: '# Chapter 1\n\nThis is the content.' }],
      };

      const result = normalizer.normalize('wiki_get_page', synapseResult);

      expect(result.status).toBe('ok');
      expect(result.data.content).toBe('# Chapter 1\n\nThis is the content.');
      expect(result.data.title).toBe('Chapter 1');
      expect(result.data.slug).toBe('chapter-1');
    });

    it('should handle page without heading', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'Just plain text content.' }],
      };

      const result = normalizer.normalize('wiki_get_page', synapseResult);

      expect(result.data.title).toBe('Untitled');
      expect(result.data.slug).toBe('untitled');
    });
  });

  describe('wiki_search', () => {
    it('should normalize search results', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'result1\nresult2\nresult3' }],
      };

      const result = normalizer.normalize('wiki_search', synapseResult);

      expect(result.status).toBe('ok');
      expect(result.data.results).toHaveLength(3);
      // Fabricated scores removed — score only present when server provides one
      expect(result.data.results[0]).toEqual({ slug: 'result1', title: 'result1' });
      expect(result.data.results[1].score).toBeUndefined();
    });

    it('should parse pipe-separated results with scores', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'page1 | Page One | 0.95\npage2 | Page Two | 0.85' }],
      };

      const result = normalizer.normalize('wiki_search', synapseResult);

      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0]).toEqual({ slug: 'page1', title: 'Page One', score: 0.95 });
    });
  });

  describe('wiki_traverse_graph / wiki_neo4j_get_related / wiki_neo4j_find_paths', () => {
    it('should normalize explore_connections output', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'character-a -> character-b (wiki_link)\ncharacter-b -> location-x (semantic)' }],
      };

      const result = normalizer.normalize('wiki_traverse_graph', synapseResult);

      expect(result.status).toBe('ok');
      expect(result.data.pathFound).toBe(true);
      expect(result.data.path).toEqual(['character-a', 'character-b', 'location-x']);
      expect(result.data.relationships).toHaveLength(2);
      expect(result.data.relationships[0]).toEqual({
        from: 'character-a',
        to: 'character-b',
        relation: 'wiki_link',
      });
      expect(result.data.distance).toBe(2);
    });

    it('should handle alternative format', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'start -- end : connected_by' }],
      };

      const result = normalizer.normalize('wiki_neo4j_find_paths', synapseResult);

      expect(result.data.relationships[0]).toEqual({
        from: 'start',
        to: 'end',
        relation: 'connected_by',
      });
    });
  });

  describe('wiki_neo4j_search → query_knowledge', () => {
    it('should parse JSON response', () => {
      const synapseResult = {
        content: [{ type: 'text', text: '{"results": [{"slug": "page1", "title": "Page 1", "score": 0.9, "snippet": "preview"}]}' }],
      };

      const result = normalizer.normalize('wiki_neo4j_search', synapseResult);

      expect(result.status).toBe('ok');
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0]).toEqual({
        slug: 'page1',
        title: 'Page 1',
        score: 0.9,
        snippet: 'preview',
      });
      expect(result.data.count).toBe(1);
    });

    it('should fall back to text parsing for non-JSON', () => {
      const synapseResult = {
        content: [{ type: 'text', text: 'result1\nresult2' }],
      };

      const result = normalizer.normalize('wiki_neo4j_search', synapseResult);

      expect(result.data.results).toHaveLength(2);
      expect(result.data.count).toBe(2);
    });
  });

  describe('error responses', () => {
    it('should normalize error responses', () => {
      const synapseResult = {
        isError: true,
        content: [{ type: 'text', text: 'Tool failed: connection timeout' }],
      };

      const result = normalizer.normalize('wiki_search', synapseResult);

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('SYNAPSE_TOOL_ERROR');
      expect(result.error.message).toBe('Tool failed: connection timeout');
    });

    it('should handle empty error', () => {
      const synapseResult = { isError: true, content: [] };
      const result = normalizer.normalize('wiki_search', synapseResult);
      expect(result.status).toBe('error');
      expect(result.error.message).toBe('Tool execution failed');
    });
  });

  describe('empty response', () => {
    it('should handle null/undefined response', () => {
      const result = normalizer.normalize('wiki_search', null);
      expect(result.status).toBe('error');
      expect(result.error.message).toBe('Empty response from server');
    });
  });

  describe('unknown tools', () => {
    it('should handle unknown tools with generic normalization', () => {
      const synapseResult = { content: [{ type: 'text', text: 'some output' }] };
      const result = normalizer.normalize('unknown_tool', synapseResult);

      expect(result.status).toBe('ok');
      expect(result.data.text).toBe('some output');
      expect(result.data.raw).toBe(synapseResult);
    });
  });
});