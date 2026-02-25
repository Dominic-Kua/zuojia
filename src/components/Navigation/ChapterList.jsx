import React, { useState, useCallback } from 'react';
import './ChapterList.css';

export const ChapterList = ({ 
  chapters, 
  currentChapter, 
  onChapterSelect, 
  hasUnsavedChanges,
  onBeforeSwitch,
  searchable = true 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredChapters = searchable && searchTerm
    ? chapters.filter(ch => 
        ch.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ch.filename.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : chapters;

  const handleChapterChange = useCallback(async (event) => {
    const newChapter = event.target.value;
    
    if (newChapter === currentChapter) {
      return;
    }

    // If there are unsaved changes and a beforeSwitch handler, call it
    if (hasUnsavedChanges && onBeforeSwitch) {
      const shouldProceed = await onBeforeSwitch();
      if (!shouldProceed) {
        // Reset the select to current chapter
        event.target.value = currentChapter;
        return;
      }
    }

    onChapterSelect(newChapter);
  }, [currentChapter, hasUnsavedChanges, onBeforeSwitch, onChapterSelect]);

  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  return (
    <div className="chapter-list">
      <div className="chapter-list-header">
        <label htmlFor="chapter-select">
          Chapter
          {hasUnsavedChanges && <span className="unsaved-indicator" title="Unsaved changes">*</span>}
        </label>
        {searchable && (
          <input
            type="text"
            className="chapter-search"
            placeholder="Search chapters..."
            value={searchTerm}
            onChange={handleSearchChange}
            aria-label="Search chapters"
          />
        )}
      </div>
      
      <select 
        id="chapter-select"
        className="chapter-dropdown"
        value={currentChapter || ''}
        onChange={handleChapterChange}
        disabled={chapters.length === 0}
      >
        {chapters.length === 0 && (
          <option value="">No chapters</option>
        )}
        
        {filteredChapters.map((chapter) => (
          <option 
            key={chapter.filename} 
            value={chapter.filename}
          >
            {chapter.title} ({chapter.wordCount || 0} words)
          </option>
        ))}
        
        {searchable && searchTerm && filteredChapters.length === 0 && (
          <option value="" disabled>No matching chapters</option>
        )}
      </select>
    </div>
  );
};
