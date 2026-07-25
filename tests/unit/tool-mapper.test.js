import { describe, it, expect } from 'vitest';
import { ToolMapper, createToolMapper } from '../../helper/src/mcp/tool-mapper.js';

describe('ToolMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = createToolMapper();
  });

  it('should create mapper instance', () => {
    expect(mapper).toBeInstanceOf(ToolMapper);
  });

  it('should map wiki_list_pages directly', () => {
    expect(mapper.mapTool('wiki_list_pages')).toBe('wiki_list_pages');
  });

  it('should map wiki_search directly', () => {
    expect(mapper.mapTool('wiki_search')).toBe('wiki_search');
  });

  it('should map wiki_get_page to wiki_read_page', () => {
    expect(mapper.mapTool('wiki_get_page')).toBe('wiki_read_page');
  });

  it('should map wiki_traverse_graph to explore_connections', () => {
    expect(mapper.mapTool('wiki_traverse_graph')).toBe('explore_connections');
  });

  it('should map wiki_neo4j_search to query_knowledge', () => {
    expect(mapper.mapTool('wiki_neo4j_search')).toBe('query_knowledge');
  });

  it('should map wiki_neo4j_get_related to explore_connections', () => {
    expect(mapper.mapTool('wiki_neo4j_get_related')).toBe('explore_connections');
  });

  it('should map wiki_neo4j_find_paths to explore_connections', () => {
    expect(mapper.mapTool('wiki_neo4j_find_paths')).toBe('explore_connections');
  });

  it('should return null for wiki_get_backlinks (no equivalent)', () => {
    expect(mapper.mapTool('wiki_get_backlinks')).toBeNull();
  });

  it('should return null for wiki_build_graph (no equivalent)', () => {
    expect(mapper.mapTool('wiki_build_graph')).toBeNull();
  });

  it('should return null for wiki_neo4j_query (no equivalent)', () => {
    expect(mapper.mapTool('wiki_neo4j_query')).toBeNull();
  });

  it('should return null for unknown tool', () => {
    expect(mapper.mapTool('unknown_tool')).toBeNull();
  });

  it('should correctly identify mapped tools', () => {
    expect(mapper.hasMapping('wiki_list_pages')).toBe(true);
    expect(mapper.hasMapping('wiki_search')).toBe(true);
    expect(mapper.hasMapping('wiki_get_page')).toBe(true);
  });

  it('should correctly identify unmapped tools', () => {
    expect(mapper.hasMapping('wiki_get_backlinks')).toBe(false);
    expect(mapper.hasMapping('wiki_build_graph')).toBe(false);
    expect(mapper.hasMapping('wiki_neo4j_query')).toBe(false);
  });

  it('should get reverse mapping for explore_connections', () => {
    const reverse = mapper.getReverseMapping('explore_connections');
    expect(reverse).toContain('wiki_traverse_graph');
    expect(reverse).toContain('wiki_neo4j_get_related');
    expect(reverse).toContain('wiki_neo4j_find_paths');
  });

  it('should get reverse mapping for query_knowledge', () => {
    const reverse = mapper.getReverseMapping('query_knowledge');
    expect(reverse).toContain('wiki_neo4j_search');
  });

  it('should return empty array for unknown reverse mapping', () => {
    const reverse = mapper.getReverseMapping('unknown_tool');
    expect(reverse).toEqual([]);
  });

  it('should list all unmapped tools', () => {
    const unmapped = mapper.getUnmappedTools();
    expect(unmapped).toContain('wiki_get_backlinks');
    expect(unmapped).toContain('wiki_build_graph');
    expect(unmapped).toContain('wiki_neo4j_query');
  });

  it('should list all mapped tools', () => {
    const mapped = mapper.getMappedTools();
    expect(mapped).toContain('wiki_list_pages');
    expect(mapped).toContain('wiki_search');
    expect(mapped).toContain('wiki_get_page');
    expect(mapped).toContain('wiki_traverse_graph');
    expect(mapped).toContain('wiki_neo4j_search');
    expect(mapped).toContain('wiki_neo4j_get_related');
    expect(mapped).toContain('wiki_neo4j_find_paths');
  });

  it('should get all mappings as Map', () => {
    const allMappings = mapper.getAllMappings();
    expect(allMappings.size).toBe(10);
    expect(allMappings.get('wiki_list_pages')).toBe('wiki_list_pages');
    expect(allMappings.get('wiki_get_backlinks')).toBeNull();
  });
});