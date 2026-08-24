const homeDir = (typeof process.env.HOME === 'string' && process.env.HOME) || '';

export const PATH_ENRICHMENT = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  homeDir ? `${homeDir}/.local/bin` : '',
  homeDir ? `${homeDir}/.cargo/bin` : '',
].filter(Boolean);
