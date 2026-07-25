/**
 * Tool Name Mapper
 * Maps Zuojia's expected MCP tool names to Project Synapse's actual tool names
 */

export class ToolMapper {
  #toolMap;
  #reverseMap;

  constructor() {
    // Zuojia tool name → Project Synapse tool name
    this.#toolMap = new Map([
      // Direct mappings
      ['wiki_list_pages', 'wiki_list_pages'],
      ['wiki_search', 'wiki_search'],
      
      // Name translations
      ['wiki_get_page', 'wiki_read_page'],
      ['wiki_get_backlinks', null], // Not available in Project Synapse
      ['wiki_build_graph', null], // Not available in Project Synapse
      ['wiki_traverse_graph', 'explore_connections'],
      
      // Neo4j tools mapped to closest equivalents
      ['wiki_neo4j_search', 'query_knowledge'],
      ['wiki_neo4j_get_related', 'explore_connections'],
      ['wiki_neo4j_find_paths', 'explore_connections'],
      ['wiki_neo4j_query', null], // No direct equivalent

      // Synapse ingestion tools
      ['ingest_text', 'ingest_text'],
    ]);

    // Build reverse map
    this.#reverseMap = new Map();
    for (const [zuojia, synapse] of this.#toolMap) {
      if (synapse) {
        if (!this.#reverseMap.has(synapse)) {
          this.#reverseMap.set(synapse, []);
        }
        this.#reverseMap.get(synapse).push(zuojia);
      }
    }
  }

  /**
   * Get the Project Synapse tool name for a Zuojia tool
   * @param {string} zuojiaTool - Zuojia tool name
   * @returns {string|null} Project Synapse tool name or null if not available
   */
  mapTool(zuojiaTool) {
    return this.#toolMap.get(zuojiaTool) || null;
  }

  /**
   * Check if a Zuojia tool has a mapping
   * @param {string} zuojiaTool - Zuojia tool name
   * @returns {boolean}
   */
  hasMapping(zuojiaTool) {
    return this.#toolMap.has(zuojiaTool) && this.#toolMap.get(zuojiaTool) !== null;
  }

  /**
   * Get all Zuojia tools that map to a specific Project Synapse tool
   * @param {string} synapseTool - Project Synapse tool name
   * @returns {string[]} Array of Zuojia tool names
   */
  getReverseMapping(synapseTool) {
    return this.#reverseMap.get(synapseTool) || [];
  }

  /**
   * Get all available mappings
   * @returns {Map<string, string|null>} Map of Zuojia → Project Synapse
   */
  getAllMappings() {
    return new Map(this.#toolMap);
  }

  /**
   * Get list of Zuojia tools without direct Project Synapse equivalent
   * @returns {string[]} Array of unmapped tool names
   */
  getUnmappedTools() {
    const unmapped = [];
    for (const [zuojia, synapse] of this.#toolMap) {
      if (synapse === null) {
        unmapped.push(zuojia);
      }
    }
    return unmapped;
  }

  /**
   * Get list of Zuojia tools with direct mapping
   * @returns {string[]} Array of mapped tool names
   */
  getMappedTools() {
    const mapped = [];
    for (const [zuojia, synapse] of this.#toolMap) {
      if (synapse !== null) {
        mapped.push(zuojia);
      }
    }
    return mapped;
  }
}

export function createToolMapper() {
  return new ToolMapper();
}