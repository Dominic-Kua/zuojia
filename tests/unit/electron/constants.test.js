// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  SIGTERM_TO_SIGKILL_MS,
  GRACEFUL_EXIT_FALLBACK_MS,
  MAX_RETRY_DELAY_MS,
  BASE_RETRY_DELAY_MS,
  TOOL_CALL_TIMEOUT_MS,
  NEO4J_STARTUP_TIMEOUT_MS,
  EMBEDDING_TOOL_TIMEOUT_MS,
  HEALTH_CHECK_TIMEOUT_MS,
  HEALTH_POLL_DEADLINE_MS,
  DOWNLOAD_TIMEOUT_MS,
  MAX_LOGS,
  DEFAULT_LOGS_LIMIT,
  MIN_MODEL_FILE_SIZE,
  MIN_DOWNLOADED_SIZE,
  WIKI_DEFAULT_LIMIT,
  WIKI_DEFAULT_MAX_DEPTH,
  WIKI_DEFAULT_MAX_EDGES,
  WIKI_IMPORT_MAX_EDGES,
} from '../../../electron/constants.js';

describe('constants', () => {
  it('SIGTERM escalation timeout is 5s', () => {
    expect(SIGTERM_TO_SIGKILL_MS).toBe(5000);
  });

  it('graceful exit fallback is 2s', () => {
    expect(GRACEFUL_EXIT_FALLBACK_MS).toBe(2000);
  });

  it('retry delays are correct', () => {
    expect(BASE_RETRY_DELAY_MS).toBe(1000);
    expect(MAX_RETRY_DELAY_MS).toBe(10_000);
  });

  it('tool call timeout is 5s', () => {
    expect(TOOL_CALL_TIMEOUT_MS).toBe(5000);
  });

  it('Neo4j startup timeout is 30s', () => {
    expect(NEO4J_STARTUP_TIMEOUT_MS).toBe(30_000);
  });

  it('embedding tool timeout is 3min', () => {
    expect(EMBEDDING_TOOL_TIMEOUT_MS).toBe(180_000);
  });

  it('health check timeout is 3s', () => {
    expect(HEALTH_CHECK_TIMEOUT_MS).toBe(3000);
  });

  it('health poll deadline is 60s', () => {
    expect(HEALTH_POLL_DEADLINE_MS).toBe(60_000);
  });

  it('download timeout is 10min', () => {
    expect(DOWNLOAD_TIMEOUT_MS).toBe(600_000);
  });

  it('log limits are correct', () => {
    expect(MAX_LOGS).toBe(200);
    expect(DEFAULT_LOGS_LIMIT).toBe(50);
  });

  it('model size thresholds are correct', () => {
    expect(MIN_MODEL_FILE_SIZE).toBe(100_000_000);
    expect(MIN_DOWNLOADED_SIZE).toBe(1_000_000);
  });

  it('wiki defaults are correct', () => {
    expect(WIKI_DEFAULT_LIMIT).toBe(200);
    expect(WIKI_DEFAULT_MAX_DEPTH).toBe(3);
    expect(WIKI_DEFAULT_MAX_EDGES).toBe(2000);
    expect(WIKI_IMPORT_MAX_EDGES).toBe(5000);
  });
});
