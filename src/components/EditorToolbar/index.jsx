import React from 'react';
import { ChapterList } from '../Navigation/ChapterList';
import { useChapters } from '../../hooks/useChapters';
import './index.css';

export const EditorToolbar = ({ 
  novelPath, 
  currentChapter, 
  onChapterChange,
  hasUnsavedChanges,
  onBeforeSwitch
}) => {
  const { chapters, loading, error } = useChapters(novelPath);

  const handleChapterSelect = (filename) => {
    onChapterChange(filename);
  };

  return (
    <div className="editor-toolbar" data-testid="editor-toolbar">
      <div className="toolbar-section">
        {loading && <span className="toolbar-status" data-testid="toolbar-loading">Loading chapters...</span>}
        {error && <span className="toolbar-error" data-testid="toolbar-error">{error}</span>}
        {!loading && !error && (
          <ChapterList
            chapters={chapters}
            currentChapter={currentChapter}
            onChapterSelect={handleChapterSelect}
            hasUnsavedChanges={hasUnsavedChanges}
            onBeforeSwitch={onBeforeSwitch}
            searchable={true}
          />
        )}
      </div>
    </div>
  );
};
