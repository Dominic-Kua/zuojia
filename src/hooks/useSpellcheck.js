/**
 * useSpellcheck hook - Manages spellcheck dictionary loaded from wiki pages
 */

import { useState, useEffect, useCallback } from 'react';
import { wikiHandlers } from '../lib/ipc-client.ts';

/**
 * Hook for managing spellcheck dictionary from wiki pages
 * @param {string} novelPath - Path to the novel
 * @returns {Object} - {words, loading, error, isWordInDictionary, refresh}
 */
export function useSpellcheck(novelPath) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wordSet, setWordSet] = useState(new Set());
  const [wordSetLowercase, setWordSetLowercase] = useState(new Map()); // Map for case-insensitive lookup

  // Load dictionary from wiki pages
  const loadDictionary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!novelPath) {
        setWords([]);
        setWordSet(new Set());
        setWordSetLowercase(new Map());
        setLoading(false);
        return;
      }

      // Fetch wiki pages
      const result = await wikiHandlers.list(novelPath);
      const pages = result.pages || [];

      // Extract words from all page titles
      const allWords = new Set();
      const lowercaseMap = new Map(); // Maps lowercase word -> original word

      pages.forEach((page) => {
        // Split title on whitespace and punctuation - consistent with rebuild-dict
        const titleWords = page.title
          .replace(/[^\w\s-]/g, ' ') // Replace punctuation with spaces
          .split(/\s+/)
          .filter((w) => w.length > 0);

        titleWords.forEach((word) => {
          allWords.add(word);
          lowercaseMap.set(word.toLowerCase(), word);
        });
      });

      const wordArray = Array.from(allWords).sort();
      setWords(wordArray);
      setWordSet(allWords);
      setWordSetLowercase(lowercaseMap);
    } catch (err) {
      console.error('Failed to load spellcheck dictionary:', err);
      setError(err);
      setWords([]);
      setWordSet(new Set());
      setWordSetLowercase(new Map());
    } finally {
      setLoading(false);
    }
  }, [novelPath]);

  // Load dictionary on mount and when novelPath changes
  useEffect(() => {
    loadDictionary();
  }, [novelPath, loadDictionary]);

  // Check if a word is in the dictionary (case-insensitive)
  const isWordInDictionary = useCallback(
    (word) => {
      if (!word) return false;
      // First try exact match for performance
      if (wordSet.has(word)) return true;
      // Then try case-insensitive lookup
      return wordSetLowercase.has(word.toLowerCase());
    },
    [wordSet, wordSetLowercase]
  );

  return {
    words,
    loading,
    error,
    isWordInDictionary,
    refresh: loadDictionary,
  };
}
