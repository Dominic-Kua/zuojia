import { describe, it, expect, beforeEach } from 'vitest';
import { createToolMapper } from '../../helper/src/mcp/tool-mapper.js';
import { createArgumentTransformer } from '../../helper/src/mcp/argument-transformer.js';

describe('ArgumentTransformer', () => {
  let toolMapper;
  let transformer;

  beforeEach(() => {
    toolMapper = createToolMapper();
    transformer = createArgumentTransformer(toolMapper);
  });

  describe('wiki_get_page → wiki_read_page', () => {
    it('should transform slug to path with .md extension', () => {
      const result = transformer.transform('wiki_get_page', { slug: 'character-bob' });
      expect(result).toEqual({ path: 'character-bob.md' });
    });

    it('should handle slug already with .md extension', () => {
      const result = transformer.transform('wiki_get_page', { slug: 'chapter-1.md' });
      expect(result).toEqual({ path: 'chapter-1.md' });
    });

    it('should handle path argument directly', () => {
      const result = transformer.transform('wiki_get_page', { path: 'wiki/setting.md' });
      expect(result).toEqual({ path: 'wiki/setting.md' });
    });

    it('should return empty path for missing slug', () => {
      const result = transformer.transform('wiki_get_page', {});
      expect(result).toEqual({ path: '.md' });
    });
  });

  describe('wiki_search → wiki_search', () => {
    it('should pass through query and limit', () => {
      const result = transformer.transform('wiki_search', { query: 'dragon', limit: 5 });
      expect(result).toEqual({ query: 'dragon', limit: 5 });
    });

    it('should use defaults when not provided', () => {
      const result = transformer.transform('wiki_search', {});
      expect(result).toEqual({ query: '', limit: 10 });
    });
  });

  describe('wiki_list_pages → wiki_list_pages', () => {
    it('should pass through limit', () => {
      const result = transformer.transform('wiki_list_pages', { limit: 50 });
      expect(result).toEqual({ limit: 50 });
    });

    it('should use default limit', () => {
      const result = transformer.transform('wiki_list_pages', {});
      expect(result).toEqual({ limit: 200 });
    });
  });

  describe('wiki_neo4j_search → query_knowledge', () => {
    it('should transform limit to max_results', () => {
      const result = transformer.transform('wiki_neo4j_search', { query: 'magic', limit: 20 });
      expect(result).toEqual({
        query: 'magic',
        max_results: 20,
        include_insights: true,
      });
    });

    it('should use defaults', () => {
      const result = transformer.transform('wiki_neo4j_search', { query: 'test' });
      expect(result.max_results).toBe(10);
      expect(result.include_insights).toBe(true);
    });

    it('should allow disabling insights', () => {
      const result = transformer.transform('wiki_neo4j_search', { query: 'test', includeInsights: false });
      expect(result.include_insights).toBe(false);
    });
  });

  describe('wiki_traverse_graph → explore_connections', () => {
    it('should transform startSlug/targetSlug/maxDepth', () => {
      const result = transformer.transform('wiki_traverse_graph', {
        startSlug: 'character-a',
        targetSlug: 'character-b',
        maxDepth: 4,
        connectionTypes: ['wiki_link', 'semantic'],
      });
      expect(result).toEqual({
        entity: 'character-a',
        target_entity: 'character-b',
        depth: 4,
        connection_types: ['wiki_link', 'semantic'],
      });
    });

    it('should use defaults', () => {
      const result = transformer.transform('wiki_traverse_graph', { startSlug: 'a' });
      expect(result).toEqual({
        entity: 'a',
        target_entity: undefined,
        depth: 3,
        connection_types: undefined,
      });
    });
  });

  describe('wiki_neo4j_get_related → explore_connections', () => {
    it('should transform slug/depth', () => {
      const result = transformer.transform('wiki_neo4j_get_related', {
        slug: 'character-main',
        depth: 3,
        connectionTypes: ['wiki_link'],
      });
      expect(result).toEqual({
        entity: 'character-main',
        depth: 3,
        connection_types: ['wiki_link'],
      });
    });

    it('should use defaults', () => {
      const result = transformer.transform('wiki_neo4j_get_related', { slug: 'test' });
      expect(result).toEqual({
        entity: 'test',
        depth: 2,
        connection_types: undefined,
      });
    });
  });

  describe('wiki_neo4j_find_paths → explore_connections', () => {
    it('should transform startSlug/targetSlug/maxDepth', () => {
      const result = transformer.transform('wiki_neo4j_find_paths', {
        startSlug: 'start',
        targetSlug: 'end',
        maxDepth: 5,
      });
      expect(result).toEqual({
        entity: 'start',
        target_entity: 'end',
        depth: 5,
        connection_types: undefined,
      });
    });
  });

  describe('hasTransformation', () => {
    it('should return true for mapped tools', () => {
      expect(transformer.hasTransformation('wiki_list_pages')).toBe(true);
      expect(transformer.hasTransformation('wiki_search')).toBe(true);
      expect(transformer.hasTransformation('wiki_get_page')).toBe(true);
      expect(transformer.hasTransformation('wiki_neo4j_search')).toBe(true);
    });

    it('should return false for unmapped tools', () => {
      expect(transformer.hasTransformation('wiki_get_backlinks')).toBe(false);
      expect(transformer.hasTransformation('wiki_build_graph')).toBe(false);
      expect(transformer.hasTransformation('wiki_neo4j_query')).toBe(false);
    });
  });

  describe('getTargetTool', () => {
    it('should return mapped Synapse tool name', () => {
      expect(transformer.getTargetTool('wiki_get_page')).toBe('wiki_read_page');
      expect(transformer.getTargetTool('wiki_neo4j_search')).toBe('query_knowledge');
    });

    it('should return null for unmapped tools', () => {
      expect(transformer.getTargetTool('wiki_get_backlinks')).toBeNull();
    });
  });

  describe('unknown tools', () => {
    it('should return args unchanged for unknown tools', () => {
      const result = transformer.transform('unknown_tool', { foo: 'bar' });
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return false for hasTransformation on unknown tools', () => {
      expect(transformer.hasTransformation('unknown_tool')).toBe(false);
    });
  });
});