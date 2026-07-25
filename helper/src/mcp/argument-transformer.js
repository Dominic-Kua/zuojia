/**
 * Argument Transformer
 * Transforms Zuojia tool arguments to Project Synapse tool arguments
 */

export class ArgumentTransformer {
  #toolMapper;

  constructor(toolMapper) {
    this.#toolMapper = toolMapper;
  }

  /**
   * Transform arguments for a specific Zuojia tool to its Synapse equivalent
   * @param {string} zuojiaTool - Zuojia tool name
   * @param {Object} args - Arguments to transform
   * @returns {Object} Transformed arguments
   */
  transform(zuojiaTool, args = {}) {
    const synapseTool = this.#toolMapper.mapTool(zuojiaTool);
    
    if (!synapseTool) {
      // No mapping available, return original args
      return args;
    }

    switch (synapseTool) {
      case 'wiki_read_page':
        return this.#transformReadPage(args);
      case 'wiki_search':
        return this.#transformSearch(args);
      case 'explore_connections':
        return this.#transformExploreConnections(zuojiaTool, args);
      case 'query_knowledge':
        return this.#transformQueryKnowledge(args);
      case 'wiki_list_pages':
        return this.#transformListPages(args);
      default:
        return args;
    }
  }

  /**
   * wiki_get_page: { slug } → wiki_read_page: { path }
   * @param {Object} args
   * @returns {Object}
   */
  #transformReadPage(args) {
    const slug = args.slug || args.path || '';
    // Convert slug to path if needed (e.g., "character-bob" → "character-bob.md")
    const path = slug.endsWith('.md') ? slug : `${slug}.md`;
    return { path };
  }

  /**
   * wiki_search: { query, limit } → wiki_search: { query, limit }
   * @param {Object} args
   * @returns {Object}
   */
  #transformSearch(args) {
    return {
      query: args.query || '',
      limit: args.limit || 10,
    };
  }

  /**
   * wiki_list_pages: { limit } → wiki_list_pages: { limit }
   * @param {Object} args
   * @returns {Object}
   */
  #transformListPages(args) {
    return {
      limit: args.limit || 200,
    };
  }

  /**
   * query_knowledge: { query, max_results } 
   * Maps wiki_neo4j_search: { query, limit }
   * @param {Object} args
   * @returns {Object}
   */
  #transformQueryKnowledge(args) {
    return {
      query: args.query || '',
      max_results: args.limit || 10,
      include_insights: args.includeInsights !== false,
    };
  }

  /**
   * explore_connections: { entity, depth, connection_types }
   * Maps multiple Zuojia tools:
   * - wiki_traverse_graph: { startSlug, targetSlug, maxDepth }
   * - wiki_neo4j_get_related: { slug, depth }
   * - wiki_neo4j_find_paths: { startSlug, targetSlug, maxDepth }
   * @param {string} zuojiaTool - Original Zuojia tool name
   * @param {Object} args
   * @returns {Object}
   */
  #transformExploreConnections(zuojiaTool, args) {
    switch (zuojiaTool) {
      case 'wiki_traverse_graph':
        return {
          entity: args.startSlug || '',
          target_entity: args.targetSlug || undefined,
          depth: args.maxDepth || 3,
          connection_types: args.connectionTypes,
        };

      case 'wiki_neo4j_get_related':
        return {
          entity: args.slug || '',
          depth: args.depth || 2,
          connection_types: args.connectionTypes,
        };

      case 'wiki_neo4j_find_paths':
        return {
          entity: args.startSlug || '',
          target_entity: args.targetSlug || '',
          depth: args.maxDepth || 3,
          connection_types: args.connectionTypes,
        };

      default:
        return {
          entity: args.slug || args.startSlug || '',
          depth: args.depth || args.maxDepth || 2,
        };
    }
  }

  /**
   * Check if a tool has a transformation defined
   * @param {string} zuojiaTool
   * @returns {boolean}
   */
  hasTransformation(zuojiaTool) {
    const synapseTool = this.#toolMapper.mapTool(zuojiaTool);
    return synapseTool !== null;
  }

  /**
   * Get the target Synapse tool name
   * @param {string} zuojiaTool
   * @returns {string|null}
   */
  getTargetTool(zuojiaTool) {
    return this.#toolMapper.mapTool(zuojiaTool);
  }
}

export function createArgumentTransformer(toolMapper) {
  return new ArgumentTransformer(toolMapper);
}