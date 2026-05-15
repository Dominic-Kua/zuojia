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
  } catch {
    // Fall through to pdflatex fallback.
  }

  try {
    enginesTried.push('pdflatex');
    const version = getToolVersion('pdflatex');
    return {
      status: 'ok',
      data: {
        pandoc: { available: true, version: pandocVersion },
        tex: { available: true, engine: 'pdflatex', version },
        enginesTried,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return createError(
      'TEX_UNAVAILABLE',
      'A TeX engine is not installed',
      'Install via: brew install --cask mactex-no-gui',
      { error: error.message, enginesTried }
    );
  }
}