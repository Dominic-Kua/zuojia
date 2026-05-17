import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  extractWikiLinks,
  normalizeWikiSlug,
  listWikiPagesForMcp,
  getWikiBacklinksForMcp,
  buildWikiKnowledgeGraphForMcp,
} from '../src/mcp/wiki-tools.js';

describe('mcp wiki tools', () => {
  let testDir;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zuojia-mcp-test-'));
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });

    await fs.writeFile(
      path.join(testDir, 'wiki', 'alice.md'),
      '# Alice\n\nMentor is [[mentor]]. Visits [[old-town]].',
      'utf-8'
    );

    await fs.writeFile(path.join(testDir, 'wiki', 'mentor.md'), '# Mentor\n\nWise guide.', 'utf-8');

    await fs.writeFile(path.join(testDir, 'wiki', 'old-town.md'), '# Old Town\n\nAncient district.', 'utf-8');

    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      '# Chapter 1\n\n[[alice]] meets [[mentor]].',
      'utf-8'
    );
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  it('normalizes wiki slugs', () => {
    expect(normalizeWikiSlug(' Old Town ')).toBe('old-town');
    expect(normalizeWikiSlug('People/Lead Hero')).toBe('people/lead-hero');
  });

  it('extracts wiki links', () => {
    const links = extractWikiLinks('[[Alice]] and [[mentor|The Mentor]] and [[ old town ]]');
    expect(links).toEqual(['alice', 'mentor', 'old-town']);
  });

  it('ignores wiki-link syntax inside fenced and inline code blocks', () => {
    const links = extractWikiLinks([
      'Normal [[alice]] link.',
      '```md',
      'Code fence [[mentor]] should be ignored.',
      '```',
      'Inline `[[old-town]]` should also be ignored.',
    ].join('\n'));
    expect(links).toEqual(['alice']);
  });

  it('lists wiki pages for mcp', async () => {
    const result = await listWikiPagesForMcp(testDir, 10);
    expect(result.status).toBe('ok');
    expect(result.data.total).toBe(3);
    expect(result.data.pages.length).toBe(3);
  });

  it('returns backlinks from wiki and manuscript', async () => {
    const result = await getWikiBacklinksForMcp(testDir, 'mentor', 20);
    expect(result.status).toBe('ok');
    expect(result.data.references.length).toBe(2);

    const sourceTypes = result.data.references.map((entry) => entry.sourceType).sort();
    expect(sourceTypes).toEqual(['manuscript', 'wiki']);
  });

  it('builds graph edges from wiki links', async () => {
    const result = await buildWikiKnowledgeGraphForMcp(testDir, 50);
    expect(result.status).toBe('ok');
    expect(result.data.nodeCount).toBe(3);
    expect(result.data.edgeCount).toBe(2);

    expect(result.data.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'alice', to: 'mentor', relation: 'wiki_link' }),
        expect.objectContaining({ from: 'alice', to: 'old-town', relation: 'wiki_link' }),
      ])
    );
  });
});
