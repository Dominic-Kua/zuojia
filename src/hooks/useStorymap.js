import { useCallback, useEffect, useRef, useState } from 'react';
import { storymapHandlers } from '../lib/ipc-client';

const SAVE_DEBOUNCE_MS = 300;

export function useStorymap(novelPath) {
  const [storymap, setStorymap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!novelPath) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    storymapHandlers
      .load(novelPath)
      .then((data) => {
        if (!cancelled) {
          setStorymap(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [novelPath]);

  const scheduleSave = useCallback(
    (nextStorymap) => {
      if (!novelPath) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        saveTimerRef.current = null;
        try {
          await storymapHandlers.save(novelPath, nextStorymap);
        } catch (err) {
          console.error('Failed to save storymap:', err);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [novelPath]
  );

  const updateStorymap = useCallback(
    (updater) => {
      setStorymap((current) => {
        if (!current) return current;
        const next = typeof updater === 'function' ? updater(current) : updater;
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return { storymap, loading, error, updateStorymap };
}
