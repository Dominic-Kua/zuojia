/**
 * useWordCount hook
 * Manages word count statistics for manuscript, chapter, and today
 * @module hooks/useWordCount
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { statsHandlers } from '../lib/ipc-client';

/**
 * Hook to manage word count statistics
 * 
 * @param {string} novelPath - Path to the novel directory
 * @param {string} currentChapter - Current chapter filename
 * @param {string} content - Current chapter content
 * @returns {object} Word count state and methods
 */
export function useWordCount(novelPath, currentChapter, content) {
  const [manuscriptCount, setManuscriptCount] = useState(0);
  const [chapterCount, setChapterCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const debounceTimerRef = useRef(null);
  const todayCountIntervalRef = useRef(null);
  const manuscriptCountIntervalRef = useRef(null);
  const lastManuscriptFetchRef = useRef(0);
  const lastCountedContentRef = useRef(null);

  // Debounce delay for content changes (ms)
  const DEBOUNCE_DELAY = 300;
  // Cache manuscript count for this long (ms) - reduced for more frequent updates
  const MANUSCRIPT_CACHE_DURATION = 1 * 60 * 1000; // 1 minute
  // Refresh today count every 30 seconds (ms)
  const TODAY_COUNT_REFRESH_INTERVAL = 30 * 1000;

  /**
   * Load chapter word count
   */
  const loadChapterCount = useCallback(async (contentToCount) => {
    try {
      const result = await statsHandlers.wordCount(contentToCount);
      setChapterCount(result.wordCount);
      lastCountedContentRef.current = contentToCount;
    } catch (err) {
      console.error('Error loading chapter count:', err);
      setError(err);
    }
  }, []);

  /**
   * Load manuscript word count (cached)
   */
  const loadManuscriptCount = useCallback(async (force = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastManuscriptFetchRef.current;

    // Use cache unless forced or cache expired
    if (!force && timeSinceLastFetch < MANUSCRIPT_CACHE_DURATION) {
      return;
    }

    try {
      const result = await statsHandlers.manuscriptCount(novelPath);
      setManuscriptCount(result.wordCount);
      lastManuscriptFetchRef.current = now;
    } catch (err) {
      console.error('Error loading manuscript count:', err);
      setError(err);
    }
  }, [novelPath]);

  /**
   * Load today's word count
   */
  const loadTodayCount = useCallback(async () => {
    try {
      const result = await statsHandlers.todayCount(novelPath);
      setTodayCount(result.wordCount);
    } catch (err) {
      console.error('Error loading today count:', err);
      setError(err);
    }
  }, [novelPath]);

  /**
   * Refresh all counts
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadChapterCount(content),
        loadManuscriptCount(true), // Force refresh
        loadTodayCount(),
      ]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [content, loadChapterCount, loadManuscriptCount, loadTodayCount]);

  /**
   * Load all counts on mount and when chapter changes
   */
  useEffect(() => {
    const loadCounts = async () => {
      setLoading(true);
      setError(null);

      try {
        await Promise.all([
          loadChapterCount(content),
          loadManuscriptCount(),
          loadTodayCount(),
        ]);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadCounts();
  }, [currentChapter, novelPath, loadChapterCount, loadManuscriptCount, loadTodayCount]);

  /**
   * Periodically refresh today's word count (based on git history).
   * The mount effect above already performs the initial fetch.
   */
  useEffect(() => {
    if (!novelPath) {
      return;
    }

    // Set up periodic refresh
    todayCountIntervalRef.current = setInterval(() => {
      loadTodayCount();
    }, TODAY_COUNT_REFRESH_INTERVAL);

    return () => {
      if (todayCountIntervalRef.current) {
        clearInterval(todayCountIntervalRef.current);
      }
    };
  }, [novelPath, loadTodayCount]);

  /**
   * Update chapter count when content changes (debounced)
   */
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't debounce initial load (handled by mount effect)
    if (loading) {
      return;
    }

    // Skip recounting when content has not changed since the last successful count.
    if (lastCountedContentRef.current === content) {
      return;
    }

    // Debounce content changes
    debounceTimerRef.current = setTimeout(() => {
      loadChapterCount(content);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, loading, loadChapterCount]);

  /**
   * Cleanup timers on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (todayCountIntervalRef.current) {
        clearInterval(todayCountIntervalRef.current);
      }
    };
  }, []);

  return {
    manuscriptCount,
    chapterCount,
    todayCount,
    loading,
    error,
    refresh,
  };
}
