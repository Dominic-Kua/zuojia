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

      const result = await wikiHandlers.rebuildDict(novelPath);
      const nextWords = result?.words || [];
      const allWords = new Set(nextWords);
      const lowercaseMap = new Map();

      nextWords.forEach((word) => {
        lowercaseMap.set(word.toLowerCase(), word);
      });

      setWords(nextWords);
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

  useEffect(() => {
    const handleDictionaryUpdated = (event) => {
      if (!event?.detail?.novelPath || event.detail.novelPath !== novelPath) {
        return;
      }

      loadDictionary();
    };

    window.addEventListener('netwriter:wiki-dictionary-updated', handleDictionaryUpdated);
    return () => {
      window.removeEventListener('netwriter:wiki-dictionary-updated', handleDictionaryUpdated);
    };
  }, [loadDictionary, novelPath]);

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
