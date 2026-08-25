// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
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
    fs.access.mockReset();
    fs.realpath.mockReset();
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

  it('returns null when neither Cellar nor PATH has neo4j', async () => {
    fs.readdir.mockRejectedValue(new Error('ENOENT'));
    execSync.mockImplementation(() => {
      throw new Error('not found');
    });

    const result = await findNeo4jHome();
    expect(result).toBeNull();
  });
});
