// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  NEO4J_BOLT_URI,
  NEO4J_USERNAME,
  NEO4J_PASSWORD,
  NEO4J_DATABASE,
  NEO4J_DATA_DIR_NAME,
  NEO4J_CONFIG_NAME,
  NEO4J_CONFIG_INI_DIR,
} from '../../../electron/neo4j-defaults.js';

describe('neo4j-defaults', () => {
  it('exports expected bolt URI', () => {
    expect(NEO4J_BOLT_URI).toBe('bolt://localhost:7687');
  });

  it('exports default credentials', () => {
    expect(NEO4J_USERNAME).toBe('neo4j');
    expect(NEO4J_PASSWORD).toBe('neo4j');
  });

  it('exports database name', () => {
    expect(NEO4J_DATABASE).toBe('wiki');
  });

  it('exports data directory constants', () => {
    expect(NEO4J_DATA_DIR_NAME).toBe('neo4j-data');
    expect(NEO4J_CONFIG_NAME).toBe('neo4j.conf');
    expect(NEO4J_CONFIG_INI_DIR).toBe('.zuojia');
  });
});
