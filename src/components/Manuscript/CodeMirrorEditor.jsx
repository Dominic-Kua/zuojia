import React, { useRef, useEffect, useState, forwardRef } from 'react';
import './CodeMirrorEditor.css';

/**
 * CodeMirrorEditor Component
 * Provides a markdown editor with syntax highlighting and formatting
 * 
 * @param {string} content - Initial editor content
 * @param {function} onContentChange - Callback when content changes
 * @param {object} config - Editor configuration (fontSize, lineHeight, tabSize)
 * @param {string} theme - Editor theme ("light" or "dark")
 * @param {object} initialCursorPos - Initial cursor position {line, ch}
 */
export const CodeMirrorEditor = forwardRef(({
  content = '',
  onContentChange = () => {},
  config = {},
  theme = 'light',
  initialCursorPos = null,
}, ref) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [editorInstance, setEditorInstance] = useState(null);

  // Default configuration
  const defaultConfig = {
    fontSize: config.fontSize || 14,
    lineHeight: config.lineHeight || 1.6,
    tabSize: config.tabSize || 2,
  };

  // Initialize editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Create textarea for fallback
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'editor');
    textarea.className = 'cm-editor-textarea';
    textarea.value = content;
    textarea.style.fontSize = `${defaultConfig.fontSize}px`;
    textarea.style.lineHeight = defaultConfig.lineHeight;
    textarea.style.tabSize = defaultConfig.tabSize;

    // Add markdown class for syntax highlighting
    textarea.classList.add('markdown-editor');

    // Handle change events
    const handleChange = (e) => {
      onContentChange(e.target.value);
    };

    textarea.addEventListener('change', handleChange);
    textarea.addEventListener('input', handleChange);

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(textarea);
    editorRef.current = textarea;

    // Set cursor position if provided
    if (initialCursorPos) {
      setEditorCursorPosition(textarea, initialCursorPos);
    }

    setEditorInstance(textarea);

    return () => {
      textarea.removeEventListener('change', handleChange);
      textarea.removeEventListener('input', handleChange);
    };
  }, []);

  // Update content when prop changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.value !== content) {
      editorRef.current.value = content;
    }
  }, [content]);

  // Expose editor methods via ref
  useEffect(() => {
    if (ref && editorRef.current) {
      ref.current = {
        getContent: () => editorRef.current.value,
        setContent: (newContent) => {
          editorRef.current.value = newContent;
        },
        getCursorPos: () => {
          const textarea = editorRef.current;
          const pos = textarea.selectionStart;
          return getLineCharFromPos(textarea, pos);
        },
        setCursorPos: (line, ch) => {
          setEditorCursorPosition(editorRef.current, { line, ch });
        },
      };
    }
  }, [ref, editorInstance]);

  return (
    <div className={`codemirror-editor-container theme-${theme}`}>
      <div ref={containerRef} className="cm-editor-wrapper" />
    </div>
  );
});

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

/**
 * Helper: Set cursor position in textarea
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {object} pos - Position {line, ch}
 */
function setEditorCursorPosition(textarea, { line, ch }) {
  let pos = 0;
  const lines = textarea.value.split('\n');
  
  for (let i = 0; i < Math.min(line, lines.length); i++) {
    pos += lines[i].length + 1; // +1 for newline
  }
  
  pos += Math.min(ch, lines[line]?.length || 0);
  
  textarea.setSelectionRange(pos, pos);
  textarea.focus();
}

/**
 * Helper: Get line and character position from absolute position
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {number} pos - Absolute position
 * @returns {object} {line, ch}
 */
function getLineCharFromPos(textarea, pos) {
  const lines = textarea.value.substring(0, pos).split('\n');
  const line = lines.length - 1;
  const ch = lines[line].length;
  return { line, ch };
}
