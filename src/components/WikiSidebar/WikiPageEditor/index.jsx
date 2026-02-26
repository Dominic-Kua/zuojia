import React, { useState, useEffect, useRef, useCallback } from 'react'
import './WikiPageEditor.css'

/**
 * WikiPageEditor - CodeMirror markdown editor for wiki pages
 * Features:
 * - Manual save button
 * - Auto-save after 5 min idle
 * - Unsaved changes warning on close
 * - Save status indicator
 * 
 * @param {Object} props
 * @param {Object} props.page - Wiki page object {slug, title, content}
 * @param {Function} props.onSave - Called with updated page object on save
 * @param {Function} props.onClose - Called when close button clicked
 * @param {boolean} props.isSaving - Whether save is in progress
 */
export default function WikiPageEditor({ page, onSave, onClose, isSaving = false }) {
  const [content, setContent] = useState(page?.content ?? '')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSavedContent, setLastSavedContent] = useState(page?.content ?? '')
  const autoSaveTimerRef = useRef(null)

  // Handle content changes
  const handleContentChange = useCallback((e) => {
    const newContent = e.target.value
    setContent(newContent)
    setHasUnsavedChanges(newContent !== lastSavedContent)

    // Reset auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new auto-save timer (5 minutes = 300000 ms)
    autoSaveTimerRef.current = setTimeout(() => {
      handleAutoSave(newContent)
    }, 5 * 60 * 1000)
  }, [lastSavedContent])

  // Auto-save functionality
  const handleAutoSave = useCallback((contentToSave) => {
    if (contentToSave !== lastSavedContent && onSave) {
      onSave({
        slug: page.slug,
        title: page.title,
        content: contentToSave,
      })
      setLastSavedContent(contentToSave)
      setHasUnsavedChanges(false)
    }
  }, [page, lastSavedContent, onSave])

  // Manual save
  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    
    onSave({
      slug: page.slug,
      title: page.title,
      content,
    })
    setLastSavedContent(content)
    setHasUnsavedChanges(false)
  }, [page, content, onSave])

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Close without saving?'
      )
      if (!confirmed) return
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    onClose()
  }, [hasUnsavedChanges, onClose])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // Update when page changes externally
  useEffect(() => {
    if (page?.content !== undefined) {
      const newContent = page.content ?? ''
      setContent(newContent)
      setLastSavedContent(newContent)
      setHasUnsavedChanges(false)
    }
  }, [page])

  return (
    <div className={`wiki-page-editor ${hasUnsavedChanges ? 'unsaved' : ''}`}>
      {/* Header */}
      <div className="editor-header">
        <div className="editor-title-section">
          <h2 className="editor-title">{page?.title}</h2>
          <div className="editor-slug">{page?.slug}</div>
        </div>
        <div className="editor-status">
          {hasUnsavedChanges && (
            <span className="status-indicator unsaved-indicator">● Unsaved changes</span>
          )}
          {isSaving && (
            <span className="status-indicator saving-indicator">⟳ Saving...</span>
          )}
          {!hasUnsavedChanges && !isSaving && (
            <span className="status-indicator saved-indicator">✓ All changes saved</span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="editor-container">
        <textarea
          className="editor-textarea"
          value={content}
          onChange={handleContentChange}
          placeholder="Enter wiki page content in Markdown format..."
          spellCheck="true"
        />
      </div>

      {/* Footer with buttons */}
      <div className="editor-footer">
        <button
          className="btn btn-primary"
          onClick={handleManualSave}
          disabled={isSaving || !hasUnsavedChanges}
          title={isSaving ? 'Saving...' : 'Save changes (Ctrl+S)'}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleClose}
          disabled={isSaving}
          title="Close editor (Ctrl+Q)"
        >
          Close
        </button>
        <div className="editor-hint">
          Auto-saves after 5 minutes of inactivity
        </div>
      </div>
    </div>
  )
}
