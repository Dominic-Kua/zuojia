import { useEffect, useRef, useState, useCallback } from 'react';
import { gitHandlers } from '../lib/ipc-client';

/**
 * Hook for autosaving chapter content
 * Debounces content changes and commits to git on idle
 * @param {string} novelPath - Path to the novel
 * @param {string} filename - Current chapter filename
 * @param {string} content - Current chapter content
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 300)
 * @param {number} autocommitMs - Time to wait before auto-commit after last change (default: 300000 = 5 min)
 * @returns {object} - { isSaving, saveError, hasUnsavedChanges }
 */
export const useAutosave = (novelPath, filename, content, debounceMs = 300, autocommitMs = 300000) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const debounceTimerRef = useRef(null);
  const commitTimerRef = useRef(null);
  const lastSavedContentRef = useRef(content);

  // Perform the actual git commit
  const performCommit = useCallback(async () => {
    if (!novelPath || !filename || !content) {
      return;
    }

    if (content === lastSavedContentRef.current) {
      // No changes since last save
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const result = await gitHandlers.commit(novelPath, filename, content);

      lastSavedContentRef.current = content;
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Autosave failed:', err);
      setSaveError({
        message: err.message || 'Failed to autosave chapter',
        code: err.code,
      });
      // Keep hasUnsavedChanges = true so user is aware
    } finally {
      setIsSaving(false);
    }
  }, [novelPath, filename, content]);

  // Schedule a commit after the debounce + autocommit delay
  const scheduleCommit = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      commitTimerRef.current = setTimeout(async () => {
        await performCommit();
      }, autocommitMs - debounceMs);
    }, debounceMs);
  }, [performCommit, debounceMs, autocommitMs]);

  // Mark as unsaved when content changes
  useEffect(() => {
    if (content !== lastSavedContentRef.current) {
      setHasUnsavedChanges(true);
      setSaveError(null);
      scheduleCommit();
    }
  }, [content, scheduleCommit]);

  // Manual save trigger
  const manualSave = useCallback(async () => {
    // Clear existing timers to force immediate save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }

    await performCommit();
  }, [performCommit]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    saveError,
    hasUnsavedChanges,
    manualSave,
  };
};
