import { useState, useEffect, useCallback, useRef } from 'react';
import { indexHandlers, chapterHandlers } from '../lib/ipc-client';

export const useChapters = (novelPath) => {
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Guards against stale getIndex responses: a newer load (novel switch)
  // discards results from any older in-flight request.
  const loadSeqRef = useRef(0);

  const loadChapters = useCallback(async () => {
    if (!novelPath) {
      setLoading(false);
      return;
    }

    const requestId = ++loadSeqRef.current;

    try {
      setLoading(true);
      setError(null);
      const index = await indexHandlers.getIndex(novelPath);
      if (requestId !== loadSeqRef.current) {
        return;
      }
      setChapters(index.chapters || []);
    } catch (err) {
      if (requestId !== loadSeqRef.current) {
        return;
      }
      console.error('Failed to load chapters:', err);
      setError(err.message || 'Failed to load chapters');
      setChapters([]);
    } finally {
      if (requestId === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [novelPath]);

  // Load chapters from index
  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  // Load chapter content from disk
  const loadChapter = useCallback(async (filename) => {
    if (!novelPath || !filename) {
      return null;
    }

    try {
      const content = await chapterHandlers.readChapter(novelPath, filename);
      return content;
    } catch (err) {
      console.error('Failed to load chapter:', err);
      throw new Error(err.message || 'Failed to load chapter');
    }
  }, [novelPath]);

  // Save chapter content to disk
  const saveChapter = useCallback(async (filename, content) => {
    if (!novelPath || !filename) {
      return;
    }

    try {
      await chapterHandlers.writeChapter(novelPath, filename, content);
    } catch (err) {
      console.error('Failed to save chapter:', err);
      throw new Error(err.message || 'Failed to save chapter');
    }
  }, [novelPath]);

  return {
    chapters,
    currentChapter,
    setCurrentChapter,
    loading,
    error,
    loadChapter,
    saveChapter,
    refresh: loadChapters
  };
};
