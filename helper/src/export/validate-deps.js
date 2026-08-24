import { execFileSync } from 'child_process';
import { createError } from '../util/error.js';

function getToolVersion(command) {
  return execFileSync(command, ['--version'], { encoding: 'utf-8' }).split('\n')[0].trim();
}

export async function validateExportDependencies() {
  let pandocVersion;
  const enginesTried = [];

  try {
    pandocVersion = getToolVersion('pandoc');
  } catch (error) {
    return createError(
      'PANDOC_UNAVAILABLE',
      'Pandoc is not installed',
      'Install via: brew install pandoc',
      { error: error.message }
    );
  }

  try {
    enginesTried.push('xelatex');
    const version = getToolVersion('xelatex');
    return {
      status: 'ok',
      data: {
        pandoc: { available: true, version: pandocVersion },
        tex: { available: true, engine: 'xelatex', version },
        enginesTried,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // No pdflatex fallback: the export template requires xelatex for CJK
    // text (manuscripts are Chinese-first), and pdflatex would silently
    // produce PDFs with missing glyphs.
    return createError(
      'TEX_UNAVAILABLE',
      'xelatex is not installed (required for CJK-aware PDF export)',
      'Install via: brew install --cask basictex  (then: sudo tlmgr update --self)',
      { error: error.message, enginesTried }
    );
  }
}