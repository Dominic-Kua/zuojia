// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync, execSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/Users/test'),
}));

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    access: vi.fn(),
    realpath: vi.fn(),
  },
}));

import fs from 'fs/promises';
import { findNeo4jHome } from '../../../electron/find-neo4j.js';

describe('findNeo4jHome', () => {
  beforeEach(() => {
    fs.readdir.mockReset();
    fs.access.mockReset().mockRejectedValue(new Error('ENOENT'));
    fs.realpath.mockReset();
    execFileSync.mockReset().mockImplementation(() => {
      throw new Error('not found');
    });
    execSync.mockReset();
  });

  it('returns latest version from Homebrew Cellar', async () => {
    fs.readdir.mockResolvedValue([
      { name: '2026.01.0', isDirectory: () => true },
      { name: '2026.06.0', isDirectory: () => true },
      { name: '2026.03.0', isDirectory: () => true },
    ]);
    fs.access.mockResolvedValue(undefined);

    const result = await findNeo4jHome();
    expect(result).toBe('/opt/homebrew/Cellar/neo4j/2026.06.0/libexec');
  });

  it('skips non-version directories', async () => {
    fs.readdir.mockResolvedValue([
      { name: '2026.06.0', isDirectory: () => true },
      { name: '.DS_Store', isDirectory: () => false },
      { name: 'README', isDirectory: () => false },
    ]);
    fs.access.mockResolvedValue(undefined);

    const result = await findNeo4jHome();
    expect(result).toBe('/opt/homebrew/Cellar/neo4j/2026.06.0/libexec');
  });

  it('skips versions where libexec does not exist', async () => {
    fs.readdir.mockResolvedValue([
      { name: '2026.06.0', isDirectory: () => true },
      { name: '2026.03.0', isDirectory: () => true },
    ]);
    fs.access
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined);

    const result = await findNeo4jHome();
    expect(result).toBe('/opt/homebrew/Cellar/neo4j/2026.03.0/libexec');
  });

  it('falls back to which neo4j when Cellar is missing', async () => {
    fs.readdir.mockRejectedValue(new Error('ENOENT'));
    execSync.mockReturnValue('/opt/homebrew/bin/neo4j\n');
    fs.realpath.mockResolvedValue('/opt/homebrew/bin/neo4j');

    const result = await findNeo4jHome();
    expect(result).toBe('/opt/homebrew/bin');
  });

  it('finds a Neo4j server bundled in the Applications app resources', async () => {
    fs.readdir.mockRejectedValue(new Error('ENOENT'));
    fs.access.mockImplementation(async (candidate) => {
      if (candidate === '/Applications/Neo4j.app/Contents/Resources/bin/neo4j') return;
      throw new Error('ENOENT');
    });

    const result = await findNeo4jHome();

    expect(result).toBe('/Applications/Neo4j.app/Contents/Resources');
    expect(execSync).not.toHaveBeenCalled();
  });

  it('searches Neo4j application support subdirectories', async () => {
    fs.readdir.mockImplementation(async (directory) => {
      if (directory === '/opt/homebrew/Cellar/neo4j') throw new Error('ENOENT');
      if (directory === '/Users/test/Library/Application Support/Neo4j') {
        return [{ name: 'neo4j-server', isDirectory: () => true }];
      }
      throw new Error('ENOENT');
    });
    fs.access.mockImplementation(async (candidate) => {
      if (candidate === '/Users/test/Library/Application Support/Neo4j/neo4j-server/bin/neo4j') return;
      throw new Error('ENOENT');
    });

    const result = await findNeo4jHome();

    expect(result).toBe('/Users/test/Library/Application Support/Neo4j/neo4j-server');
    expect(execSync).not.toHaveBeenCalled();
  });

  it('uses Spotlight as the last resort after PATH lookup fails', async () => {
    fs.readdir.mockRejectedValue(new Error('ENOENT'));
    fs.access.mockImplementation(async (candidate) => {
      if (candidate === '/opt/neo4j/bin/neo4j') return;
      throw new Error('ENOENT');
    });
    execSync.mockImplementation(() => {
      throw new Error('not found');
    });
    execFileSync.mockReturnValue('/opt/neo4j/bin/neo4j\n');
    fs.realpath.mockResolvedValue('/opt/neo4j/bin/neo4j');

    const result = await findNeo4jHome();

    expect(execFileSync).toHaveBeenCalledWith(
      'mdfind',
      [expect.stringContaining('kMDItemFSName')],
      expect.objectContaining({ encoding: 'utf-8' })
    );
    expect(result).toBe('/opt/neo4j');
  });

  it('returns null when no supported Neo4j installation is found', async () => {
    fs.readdir.mockRejectedValue(new Error('ENOENT'));
    execSync.mockImplementation(() => {
      throw new Error('not found');
    });
    execFileSync.mockImplementation(() => {
      throw new Error('Spotlight unavailable');
    });

    const result = await findNeo4jHome();
    expect(result).toBeNull();
  });
});
