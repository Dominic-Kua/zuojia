/**
 * Response Normalizer
 * Converts Project Synapse tool responses to Zuojia's expected format
 */

export class ResponseNormalizer {
  /**
   * Normalize a tool response to Zuojia format
   * @param {string} zuojiaTool - Original Zuojia tool name
   * @param {Object} synapseResult - Result from Project Synapse
   * @returns {Object} Normalized response { status: 'ok'|'error', data?, error? }
   */
  normalize(zuojiaTool, synapseResult) {
    if (!synapseResult) {
      return {
        status: 'error',
        error: { message: 'Empty response from server' },
      };
    }

    // Handle error responses
    if (synapseResult.isError) {
      return this.#normalizeError(synapseResult);
    }

    // Handle successful responses based on tool
    switch (zuojiaTool) {
      case 'wiki_list_pages':
        return this.#normalizeListPages(synapseResult);
      case 'wiki_get_page':
        return this.#normalizeGetPage(synapseResult);
      case 'wiki_search':
        return this.#normalizeSearch(synapseResult);
      case 'wiki_traverse_graph':
      case 'wiki_neo4j_get_related':
      case 'wiki_neo4j_find_paths':
        return this.#normalizeExploreConnections(synapseResult);
      case 'wiki_neo4j_search':
        return this.#normalizeQueryKnowledge(synapseResult);
      default:
        // Generic normalization for other tools
        return this.#normalizeGeneric(synapseResult);
    }
  }

  /**
   * Normalize error response
   */
  #normalizeError(synapseResult) {
    const content = synapseResult.content || [];
    const errorText = content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
    
    return {
      status: 'error',
      error: {
        code: 'SYNAPSE_TOOL_ERROR',
        message: errorText || 'Tool execution failed',
      },
    };
  }

  /**
   * wiki_list_pages: { content: [{ text: "page1\npage2" }] }
   * → { status: 'ok', data: { pages: [...] } }
   */
  #normalizeListPages(synapseResult) {
    const textContent = synapseResult.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    const pages = textContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, index) => {
        // Try to parse structured output (name|path|title)
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          return {
            slug: parts[0],
            title: parts[1] || parts[0],
            path: parts[2] || parts[0],
          };
        }
        return { slug: line, title: line, path: line };
      });

    return {
      status: 'ok',
      data: { pages },
    };
  }

  /**
   * wiki_get_page (wiki_read_page): { content: [{ text: "markdown content" }] }
   * → { status: 'ok', data: { content, title, slug } }
   */
  #normalizeGetPage(synapseResult) {
    const textContent = synapseResult.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    // Extract title from first heading if present
    const titleMatch = textContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    return {
      status: 'ok',
      data: {
        content: textContent,
        title,
        slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      },
    };
  }

  /**
   * wiki_search: { content: [{ text: "result1\nresult2" }] }
   * → { status: 'ok', data: { results: [...] } }
   */
  #normalizeSearch(synapseResult) {
    const textContent = synapseResult.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    const results = textContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, index) => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          return {
            slug: parts[0],
            title: parts[1] || parts[0],
            score: parseFloat(parts[2]) || 1.0 - index * 0.1,
          };
        }
        return { slug: line, title: line, score: 1.0 - index * 0.1 };
      });

    return {
      status: 'ok',
      data: { results },
    };
  }

  /**
   * explore_connections (wiki_traverse_graph, wiki_neo4j_get_related, wiki_neo4j_find_paths)
   * { content: [{ text: "entity1 -> entity2 (type)" }] }
   * → { status: 'ok', data: { content: [...], structuredContent: {...} } }
   */
  #normalizeExploreConnections(synapseResult) {
    const textContent = synapseResult.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    const lines = textContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Parse connection format: "source -> target (type)" or similar
    const relationships = lines.map(line => {
      const match = line.match(/^(.+?)\s*->\s*(.+?)\s*(?:\((.+)\))?$/);
      if (match) {
        return {
          from: match[1].trim(),
          to: match[2].trim(),
          relation: match[3] ? match[3].trim() : 'related',
        };
      }
      // Try alternative format
      const altMatch = line.match(/^(.+?)\s+--\s+(.+?)\s*:\s*(.+)$/);
      if (altMatch) {
        return {
          from: altMatch[1].trim(),
          to: altMatch[2].trim(),
          relation: altMatch[3].trim(),
        };
      }
      return { from: line, to: '', relation: 'unknown' };
    }).filter(r => r.from);

    // Extract unique entities in path order
    const path = [];
    const seen = new Set();
    for (const rel of relationships) {
      if (!seen.has(rel.from)) {
        path.push(rel.from);
        seen.add(rel.from);
      }
      if (rel.to && !seen.has(rel.to)) {
        path.push(rel.to);
        seen.add(rel.to);
      }
    }

    const pathFound = path.length > 0;
    const pathData = path;
    const relationshipsData = relationships;
    const distance = path.length > 1 ? path.length - 1 : 0;

    // Build structured content for the response
    const structuredContent = {
      result: {
        pathFound,
        path: pathData,
        relationships,
        distance: path.length > 1 ? path.length - 1 : 0,
      },
    };

    // Build content array for text representation
    const contentText = pathFound 
      ? `Path found: ${pathData.join(' -> ')} (${relationships.length} connections)`
      : 'No connections found';
    
    const content = [
      { type: 'text', text: contentText },
    ];

    return {
      status: 'ok',
      data: {
        content,
        structuredContent,
        // Also include the parsed data for programmatic access
        pathFound,
        path: pathData,
        relationships,
        distance: pathData.length > 1 ? pathData.length - 1 : 0,
      },
    };
  }

  /**
   * query_knowledge (wiki_neo4j_search): { content: [{ text: "results" }] }
   * → { status: 'ok', data: { results: [...], count } }
   */
  #normalizeQueryKnowledge(synapseResult) {
    const textContent = synapseResult.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    // Detect Synapse error responses (returned as text, not isError)
    if (textContent.includes('❌') || textContent.includes('Knowledge query failed') || textContent.includes('error')) {
      return {
        status: 'error',
        error: {
          code: 'SYNAPSE_KNOWLEDGE_QUERY_FAILED',
          message: textContent.slice(0, 500),
        },
      };
    }

    // Try to parse JSON from the response
    try {
      const parsed = JSON.parse(textContent);
      if (parsed.results && Array.isArray(parsed.results)) {
        return {
          status: 'ok',
          data: {
            results: parsed.results.map(r => ({
              slug: r.slug || r.id || r.title,
              title: r.title || r.slug || r.id,
              score: r.score || r.relevance || 1.0,
              snippet: r.snippet || r.excerpt || '',
            })),
            count: parsed.results.length,
          },
        };
      }
    } catch {
      // Not JSON, parse as text
    }

    const lines = textContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const results = lines.slice(0, 50).map((line, index) => ({
      slug: line,
      title: line,
      score: 1.0 - index * 0.02,
    }));

    return {
      status: 'ok',
      data: { results, count: results.length },
    };
  }

  /**
   * Generic normalization for unhandled tools
   */
  #normalizeGeneric(synapseResult) {
    const textContent = synapseResult.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    return {
      status: 'ok',
      data: {
        text: textContent,
        raw: synapseResult,
      },
    };
  }
}

export function createResponseNormalizer() {
  return new ResponseNormalizer();
}