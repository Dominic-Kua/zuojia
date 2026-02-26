import React, { useEffect, useRef, useState } from 'react'
import './WikiLinkPreview.css'

/**
 * WikiLinkPreview - Tooltip-style preview of wiki page content
 * @param {Object} props
 * @param {boolean} props.isVisible - Whether the preview should be shown
 * @param {string} props.pageName - Name of the wiki page being previewed
 * @param {string} props.pageContent - Content to preview (will be truncated to 100 chars)
 * @param {{x: number, y: number}} props.position - Position near cursor
 * @param {boolean} props.isLoading - Whether content is loading
 * @param {boolean} props.isNotFound - Whether page was not found
 * @param {boolean} props.isError - Whether an error occurred
 * @param {string} props.errorMessage - Error message to display
 * @param {boolean} props.isDarkTheme - Whether to use dark theme
 * @returns {React.ReactElement}
 */
export function WikiLinkPreview({
  isVisible = false,
  pageName = '',
  pageContent = null,
  position = { x: 0, y: 0 },
  isLoading = false,
  isNotFound = false,
  isError = false,
  errorMessage = '',
  isDarkTheme = false,
}) {
  const previewRef = useRef(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  // Adjust position to keep preview in viewport (only in browser environment)
  useEffect(() => {
    if (!previewRef.current || typeof window === 'undefined') return

    const rect = previewRef.current.getBoundingClientRect()
    const newPos = { ...position }

    // Viewport boundaries
    const padding = 10
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Adjust horizontal position
    if (position.x + rect.width + padding > viewportWidth) {
      newPos.x = Math.max(padding, viewportWidth - rect.width - padding)
    }

    // Adjust vertical position
    if (position.y + rect.height + padding > viewportHeight) {
      newPos.y = Math.max(padding, viewportHeight - rect.height - padding)
    }

    setAdjustedPosition(newPos)
  }, [position, isVisible, isLoading, isNotFound, isError])

  if (!isVisible) {
    return (
      <div className="wiki-preview-wrapper wiki-preview-hidden" role="tooltip">
      </div>
    )
  }

  // Truncate content to first 100 characters
  let displayContent = null
  if (pageContent && pageContent.length > 100) {
    displayContent = pageContent.substring(0, 100) + '...'
  } else if (pageContent) {
    displayContent = pageContent
  }

  // Determine CSS classes
  const classNames = ['wiki-preview']
  if (isDarkTheme) classNames.push('wiki-preview-dark')
  if (isLoading) classNames.push('wiki-preview-loading')
  if (isNotFound) classNames.push('wiki-preview-not-found')
  if (isError) classNames.push('wiki-preview-error')

  return (
    <div
      className="wiki-preview-wrapper"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      role="tooltip"
    >
      <div ref={previewRef} className={classNames.join(' ')}>
        <div className="wiki-preview-header">
          <div className="wiki-preview-title">{pageName}</div>
        </div>

        <div className="wiki-preview-body">
          {isLoading && (
            <div className="wiki-preview-loading-indicator">
              <span className="spinner"></span>
              Loading...
            </div>
          )}

          {isNotFound && !isLoading && (
            <div className="wiki-preview-not-found-msg">
              Page not found
            </div>
          )}

          {isError && !isLoading && (
            <div className="wiki-preview-error-msg">
              {errorMessage || 'Error loading page content'}
            </div>
          )}

          {!isLoading && !isNotFound && !isError && displayContent && (
            <div className="wiki-preview-content">
              {displayContent}
            </div>
          )}

          {!isLoading && !isNotFound && !isError && !displayContent && (
            <div className="wiki-preview-empty">
              No content available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WikiLinkPreview
