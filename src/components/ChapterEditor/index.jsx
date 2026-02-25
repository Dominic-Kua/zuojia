import React, { useState, useEffect, useCallback } from 'react';
import { EditorToolbar } from '../EditorToolbar';
import { CodeMirrorEditor } from '../Manuscript/CodeMirrorEditor';
import { Toast } from '../Toast';
import { useAutosave } from '../../hooks/useAutosave';
import { useChapters } from '../../hooks/useChapters';
import './ChapterEditor.css';

/**
 * Chapter Editor - integrates toolbar, editor, and autosave
 * @param {string} novelPath - Path to the novel
 * @param {string} initialChapter - Initial chapter filename
 */
export const ChapterEditor = ({ novelPath, initialChapter }) => {
  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [content, setContent] = useState('');
  const [showToast, setShowToast] = useState(false);

  const { chapters, loadChapter, loading, error } = useChapters(novelPath);
  const { isSaving, saveError, hasUnsavedChanges, manualSave } = useAutosave(
    novelPath,
    currentChapter,
    content
  );

  // Load chapter content when current chapter changes
  useEffect(() => {
    const loadContent = async () => {
      if (currentChapter && novelPath) {
        try {
          const chapterData = await loadChapter(currentChapter);
          setContent(chapterData);
        } catch (err) {
          console.error('Failed to load chapter:', err);
        }
      }
    };

    loadContent();
  }, [currentChapter, novelPath, loadChapter]);

  // Show toast when save error occurs
  useEffect(() => {
    if (saveError) {
      setShowToast(true);
    }
  }, [saveError]);

  const handleChapterChange = useCallback(async (newChapter) => {
    // TODO: Add unsaved changes confirmation dialog
    if (hasUnsavedChanges) {
      const shouldSwitch = window.confirm('You have unsaved changes. Save before switching?');
      if (shouldSwitch) {
        await manualSave();
      }
    }
    setCurrentChapter(newChapter);
  }, [hasUnsavedChanges, manualSave]);

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
  }, []);

  const handleCloseToast = useCallback(() => {
    setShowToast(false);
  }, []);

  return (
    <div className="chapter-editor">
      <EditorToolbar
        novelPath={novelPath}
        currentChapter={currentChapter}
        onChapterChange={handleChapterChange}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <div className="chapter-editor-status">
        {isSaving && <span className="status-indicator">Saving...</span>}
        {hasUnsavedChanges && !isSaving && (
          <span className="status-indicator">Unsaved changes</span>
        )}
      </div>

      <CodeMirrorEditor
        content={content}
        onContentChange={handleContentChange}
        config={{
          fontSize: 16,
          lineHeight: 1.6,
          tabSize: 2,
        }}
        theme="light"
      />

      {showToast && saveError && (
        <Toast
          message={saveError.message || 'Failed to autosave chapter'}
          type="error"
          onClose={handleCloseToast}
        />
      )}

      {loading && (
        <div className="chapter-editor-loading">Loading chapter...</div>
      )}

      {error && !showToast && (
        <Toast
          message={error}
          type="error"
          onClose={() => {}}
        />
      )}
    </div>
  );
};
