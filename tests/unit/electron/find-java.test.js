// @vitest-environment node

import { describe, it, expect, vi, afterEach } from 'vitest';
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
import { findJavaHome } from '../../../electron/find-java.js';

describe('findJavaHome', () => {
  const originalEnv = process.env.JAVA_HOME;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.JAVA_HOME = originalEnv;
    } else {
      delete process.env.JAVA_HOME;
    }
  });

  it('returns JAVA_HOME env var when set', async () => {
    process.env.JAVA_HOME = '/custom/java/home';
    const result = await findJavaHome();
    expect(result).toBe('/custom/java/home');
  });

  it('returns latest version from Homebrew Cellar', async () => {
    delete process.env.JAVA_HOME;
    fs.readdir.mockResolvedValue([
      { name: '21.0.10', isDirectory: () => true },
      { name: '21.0.12', isDirectory: () => true },
      { name: '21.0.11', isDirectory: () => true },
    ]);
    fs.access.mockResolvedValue(undefined);

    const result = await findJavaHome();
    expect(result).toBe('/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home');
  });

  it('skips versions where path does not exist', async () => {
    delete process.env.JAVA_HOME;
    fs.readdir.mockResolvedValue([
      { name: '21.0.12', isDirectory: () => true },
      { name: '21.0.11', isDirectory: () => true },
    ]);
    fs.access
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined);

    const result = await findJavaHome();
    expect(result).toBe('/opt/homebrew/Cellar/openjdk@21/21.0.11/libexec/openjdk.jdk/Contents/Home');
  });

  it('falls back to which java when Cellar is missing', async () => {
    delete process.env.JAVA_HOME;
    fs.readdir.mockRejectedValue(new Error('ENOENT'));
    execSync.mockReturnValue('/opt/homebrew/opt/openjdk@21/bin/java\n');
    fs.realpath.mockResolvedValue('/opt/homebrew/opt/openjdk@21/bin/java');

    const result = await findJavaHome();
    expect(result).toBe('/opt/homebrew/opt/openjdk@21');
  });

  it('returns null when neither Cellar nor PATH has java', async () => {
    delete process.env.JAVA_HOME;
    fs.readdir.mockRejectedValue(new Error('ENOENT'));
    execSync.mockImplementation(() => {
      throw new Error('not found');
    });

    const result = await findJavaHome();
    expect(result).toBeNull();
  });
});
