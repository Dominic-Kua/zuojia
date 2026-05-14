import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useChapters } from '../hooks/useChapters'
import { useSpellcheck } from '../hooks/useSpellcheck'
import { useWikiLinks } from '../hooks/useWikiLinks'
import { WikiLinkPopover } from './WikiLinkPopover'
import { findSpellingIssues, replaceMisspelledWord } from '../lib/spellcheck.js'
import { indexHandlers } from '../lib/ipc-client'

const DEFAULT_CHAPTER_FILENAME = 'chapter-01.md'
const DEFAULT_CHAPTER_CONTENT = '# Chapter 1\n\nStart writing here...'

// Block-level HTML tags whose boundaries represent implicit line breaks in
// the contenteditable editor.  Kept as a module-level constant so the same
// set is shared between the two serialization helpers below.
const EDITOR_BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'])

/**
 * Serialize the contenteditable editor DOM to a plain-text string that
 * preserves line breaks (from <br> elements and block-level tags) and
 * reconstructs wiki-link markers from their rendered <span> elements.
 *
 * This mirrors the traversal used in handleInput so that the text produced
 * here is always consistent with the `plainContent` stored in React state.
 */
const serializeEditorDom = (editor) => {
  let result = ''

  const traverse = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR') {
        result += '\n'
      } else if (node.classList.contains('wiki-link')) {
        const target = node.getAttribute('data-wiki-target')
        const display = node.getAttribute('data-wiki-display')
        result += target === display ? `[[${target}]]` : `[[${target}|${display}]]`
      } else {
        if (EDITOR_BLOCK_TAGS.has(node.tagName) && result.length > 0 && !result.endsWith('\n')) {
          result += '\n'
        }
        for (const child of node.childNodes) {
          traverse(child)
        }
      }
    }
  }

  for (const node of editor.childNodes) {
    traverse(node)
  }

  return result
}

/**
 * Return the character offset within the serialized editor text
 * (as produced by serializeEditorDom) that corresponds to the given
 * DOM position (targetNode / targetOffset).
 *
 * Mirrors the same traversal as serializeEditorDom but stops early once
 * the target DOM position is reached, returning the number of serialized
 * characters accumulated up to that point.
 */
const getSerializedOffset = (editor, targetNode, targetOffset) => {
  let length = 0
  let endsWithNewline = false
  let done = false

  const traverse = (node) => {
    if (done) return

    if (node.nodeType === Node.TEXT_NODE) {
      if (node === targetNode) {
        length += targetOffset
        done = true
        return
      }
      const text = node.textContent
      if (text.length > 0) {
        length += text.length
        endsWithNewline = text[text.length - 1] === '\n'
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR') {
        if (node === targetNode) {
          done = true
          return
        }
        length += 1
        endsWithNewline = true
      } else if (node.classList.contains('wiki-link')) {
        const target = node.getAttribute('data-wiki-target')
        const display = node.getAttribute('data-wiki-display')
        const linkStr = target === display ? `[[${target}]]` : `[[${target}|${display}]]`
        if (node === targetNode || node.contains(targetNode)) {
          length += linkStr.length
          done = true
          return
        }
        length += linkStr.length
        endsWithNewline = false
      } else {
        if (EDITOR_BLOCK_TAGS.has(node.tagName) && length > 0 && !endsWithNewline) {
          length += 1
          endsWithNewline = true
        }
        if (node === targetNode) {
          for (let i = 0; i < targetOffset && !done; i++) {
            traverse(node.childNodes[i])
          }
          done = true
          return
        }
        for (const child of node.childNodes) {
          if (done) return
          traverse(child)
        }
      }
    }
  }

  if (editor === targetNode) {
    for (let i = 0; i < targetOffset && !done; i++) {
      traverse(editor.childNodes[i])
    }
    return length
  }

  for (const node of editor.childNodes) {
    if (done) break
    traverse(node)
  }

  return length
}

export default function Manuscript({ novelPath, wikiPages = [], onOpenWikiPage }){
  const editorRef = useRef(null)
  const saveTimerRef = useRef(null)
  const highlightTimerRef = useRef(null)
  const createdDefaultRef = useRef(false)

  const [content, setContent] = useState('')
  const [isLoadingChapter, setIsLoadingChapter] = useState(false)
  const [popoverState, setPopoverState] = useState(null)
  const [spellcheckIssues, setSpellcheckIssues] = useState([])

  const {
    chapters,
    currentChapter,
    setCurrentChapter,
    loading,
    error,
    loadChapter,
    saveChapter,
    refresh
  } = useChapters(novelPath)

  const {
    words: dictionaryWords,
    loading: isSpellcheckLoading,
    refresh: refreshSpellcheckDictionary,
  } = useSpellcheck(novelPath)

  const wikiLinkHandlers = useWikiLinks(novelPath, content, wikiPages)

  // Highlight wiki links in content using DOM construction to avoid XSS
  const highlightWikiLinks = useCallback((text) => {
    const fragment = document.createDocumentFragment()
    if (!text) return fragment

    const regex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
      }

      const target = match[1].trim()
      const displayText = (match[3] || match[1]).trim()

      const span = document.createElement('span')
      span.className = 'wiki-link'
      span.setAttribute('data-wiki-target', target)
      span.setAttribute('data-wiki-display', displayText)
      span.textContent = displayText
      fragment.appendChild(span)

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }

    return fragment
  }, [])

  const applyEditorContent = useCallback((nextContent) => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    // Convert an offset measured against raw wiki-link text (e.g. "[[Target]]")
    // into an offset measured against the display text used by highlightWikiLinks (e.g. "Target").
    const toDisplayOffsetWithWikiLinks = (rawText, rawOffset) => {
      if (!rawText || rawOffset <= 0) {
        return Math.max(0, rawOffset)
      }

      let rawPos = 0
      let displayPos = 0
      const length = rawText.length

      while (rawPos < length && rawPos < rawOffset) {
        // Detect a wiki link of the form [[...]]
        if (
          rawText.charAt(rawPos) === '[' &&
          rawPos + 1 < length &&
          rawText.charAt(rawPos + 1) === '['
        ) {
          const linkStart = rawPos
          const closeIndex = rawText.indexOf(']]', linkStart + 2)

          if (closeIndex !== -1) {
            // Skip the opening brackets "[["
            rawPos += 2

            // Characters inside the link contribute to display length.
            while (rawPos < closeIndex && rawPos < rawOffset) {
              rawPos += 1
              displayPos += 1
            }

            // If we've consumed up to the requested rawOffset, stop here.
            if (rawPos >= rawOffset) {
              break
            }

            // Skip the closing brackets "]]"
            rawPos = closeIndex + 2
            continue
          }
        }

        // Normal character, contributes to both raw and display positions.
        rawPos += 1
        displayPos += 1
      }

      return displayPos
    }

    let selectionOffsets = null
    const selection = window.getSelection()
    if (
      document.activeElement === editor &&
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
    ) {
      const range = selection.getRangeAt(0)

      // Measure offsets using the same block-element-aware serialization as
      // handleInput so that newlines from block-level tags are counted.
      // editor.textContent / Range.toString() omit those implicit newlines,
      // which shifts the restored caret by the number of missing '\n's in
      // multi-line documents.
      const rawText = serializeEditorDom(editor)
      const rawStart = getSerializedOffset(editor, range.startContainer, range.startOffset)
      const rawEnd = getSerializedOffset(editor, range.endContainer, range.endOffset)

      selectionOffsets = {
        start: toDisplayOffsetWithWikiLinks(rawText, rawStart),
        end: toDisplayOffsetWithWikiLinks(rawText, rawEnd),
      }
    }

    editor.replaceChildren(highlightWikiLinks(nextContent || ''))

    if (!selectionOffsets || !selection) {
      return
    }

    const resolveTextPosition = (offset) => {
      const maxOffset = (editor.textContent || '').length
      let remaining = Math.max(0, Math.min(offset, maxOffset))
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let lastTextNode = null
      let currentNode = walker.nextNode()

      while (currentNode) {
        lastTextNode = currentNode
        const textLength = currentNode.textContent?.length || 0
        if (remaining <= textLength) {
          return { node: currentNode, offset: remaining }
        }
        remaining -= textLength
        currentNode = walker.nextNode()
      }

      if (lastTextNode) {
        return {
          node: lastTextNode,
          offset: lastTextNode.textContent?.length || 0,
        }
      }

      return { node: editor, offset: editor.childNodes.length }
    }

    const startPosition = resolveTextPosition(selectionOffsets.start)
    const endPosition = resolveTextPosition(selectionOffsets.end)
    const nextRange = document.createRange()
    nextRange.setStart(startPosition.node, startPosition.offset)
    nextRange.setEnd(endPosition.node, endPosition.offset)
    selection.removeAllRanges()
    selection.addRange(nextRange)
  }, [highlightWikiLinks])

  const handleEditorBlur = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }

    applyEditorContent(content)
  }, [applyEditorContent, content])

  const findRawWikiLinkFromSelection = useCallback(() => {
    const editor = editorRef.current
    if (!editor) {
      return null
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return null
    }

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.startContainer)) {
      return null
    }

    const prefixRange = document.createRange()
    prefixRange.setStart(editor, 0)
    prefixRange.setEnd(range.startContainer, range.startOffset)
    const cursorOffset = prefixRange.toString().length

    const rawText = editor.textContent || ''
    const regex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g
    let match

    while ((match = regex.exec(rawText)) !== null) {
      const start = match.index
      const end = match.index + match[0].length
      if (cursorOffset >= start && cursorOffset <= end) {
        return {
          target: match[1].trim(),
          display: (match[3] || match[1]).trim(),
          rect: range.getBoundingClientRect(),
        }
      }
    }

    return null
  }, [])

  // Handle clicks on wiki links
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const handleClick = async (e) => {
      const targetElement = e.target instanceof Element ? e.target : e.target?.parentElement
      const wikiLink = targetElement?.closest('.wiki-link')

      let target = null
      let display = null
      let rect = null

      if (wikiLink) {
        target = wikiLink.getAttribute('data-wiki-target')
        display = wikiLink.getAttribute('data-wiki-display')
        rect = wikiLink.getBoundingClientRect()
      } else {
        const rawLink = findRawWikiLinkFromSelection()
        if (!rawLink) {
          return
        }
        target = rawLink.target
        display = rawLink.display
        rect = rawLink.rect
      }

      e.preventDefault()
      e.stopPropagation()

      const result = await wikiLinkHandlers.handleLinkClick(target, display)
      if (!result || result.action === 'none') {
        return
      }

      if (result.action === 'open' && result.page) {
        if (onOpenWikiPage) {
          onOpenWikiPage(result.page.slug)
        }
        setPopoverState(null)
      } else if (result.action === 'disambiguate') {
        setPopoverState({
          type: 'disambiguation',
          position: { x: rect.left, y: rect.bottom + 5 },
          data: { options: result.options }
        })
      } else if (result.action === 'create') {
        setPopoverState({
          type: 'create',
          position: { x: rect.left, y: rect.bottom + 5 },
          data: { target: result.target }
        })
      }
    }

    editor.addEventListener('click', handleClick)
    return () => editor.removeEventListener('click', handleClick)
  }, [findRawWikiLinkFromSelection, wikiLinkHandlers, onOpenWikiPage])

  // Handle popover actions
  const handleSelectPage = useCallback((page) => {
    if (onOpenWikiPage) {
      onOpenWikiPage(page.slug)
    }
    setPopoverState(null)
  }, [onOpenWikiPage])

  const handleCreatePage = useCallback(async (title) => {
    const result = await wikiLinkHandlers.handleCreatePageFromLink(title)
    if (result && result.slug && onOpenWikiPage) {
      onOpenWikiPage(result.slug)
    }
    setPopoverState(null)
  }, [wikiLinkHandlers, onOpenWikiPage])

  const handleClosePopover = useCallback(() => {
    setPopoverState(null)
  }, [])

  // Create a default chapter if none exist
  useEffect(() => {
    if (!novelPath || loading || createdDefaultRef.current) {
      return
    }

    if (chapters.length === 0) {
      createdDefaultRef.current = true
      const createDefault = async () => {
        try {
          setIsLoadingChapter(true)
          await saveChapter(DEFAULT_CHAPTER_FILENAME, DEFAULT_CHAPTER_CONTENT)
          await indexHandlers.rebuildIndex(novelPath)
          await refresh()
          setCurrentChapter(DEFAULT_CHAPTER_FILENAME)
          setContent(DEFAULT_CHAPTER_CONTENT)
          applyEditorContent(DEFAULT_CHAPTER_CONTENT)
        } catch (err) {
          console.error('Failed to create default chapter:', err)
        } finally {
          setIsLoadingChapter(false)
        }
      }

      createDefault()
    }
  }, [applyEditorContent, chapters.length, loading, novelPath, refresh, saveChapter, setCurrentChapter])

  // Select the first chapter when chapters load
  useEffect(() => {
    if (!currentChapter && chapters.length > 0) {
      setCurrentChapter(chapters[0].filename)
    }
  }, [chapters, currentChapter, setCurrentChapter])

  // Load chapter content when the selection changes
  useEffect(() => {
    if (!currentChapter || !novelPath) {
      return
    }

    const loadSelectedChapter = async () => {
      try {
        setIsLoadingChapter(true)
        const chapterData = await loadChapter(currentChapter)
        const nextContent = chapterData?.content || ''
        setContent(nextContent)
        applyEditorContent(nextContent)
      } catch (err) {
        console.error('Failed to load chapter content:', err)
      } finally {
        setIsLoadingChapter(false)
      }
    }

    loadSelectedChapter()
  }, [applyEditorContent, currentChapter, loadChapter, novelPath])

  // Persist content changes to disk (debounced)
  useEffect(() => {
    if (!currentChapter || !novelPath) {
      return
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      saveChapter(currentChapter, content).catch((err) => {
        console.error('Failed to save chapter:', err)
      })
    }, 400)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [content, currentChapter, novelPath, saveChapter])

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false;
    findSpellingIssues(content, dictionaryWords)
      .then((issues) => {
        if (!cancelled) {
          setSpellcheckIssues(issues)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to run spellcheck:', err)
          // Optionally reset issues so UI remains in a known state
          setSpellcheckIssues([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [content, dictionaryWords])

  const handleApplySpellcheckSuggestion = useCallback((word, suggestion) => {
    const nextContent = replaceMisspelledWord(content, word, suggestion)
    if (nextContent === content) {
      return
    }

    setContent(nextContent)
    applyEditorContent(nextContent)
  }, [applyEditorContent, content])

  const escapeForRegex = useCallback((value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }, [])

  const handleCreateWikiFromSpellcheckIssue = useCallback(async (word) => {
    if (!word) {
      return
    }

    const issuePattern = new RegExp(`\\b${escapeForRegex(word)}\\b`, 'i')
    const originalCasingMatch = content.match(issuePattern)
    const pageTitle = originalCasingMatch?.[0] || word

    try {
      const created = await wikiLinkHandlers.handleCreatePageFromLink(pageTitle)

      // Reload dictionary immediately so the issue disappears without waiting
      // for a later event cycle.
      await refreshSpellcheckDictionary({ forceRebuild: true })

      if (created?.slug && onOpenWikiPage) {
        onOpenWikiPage(created.slug)
      }
    } catch (err) {
      console.error('Failed to create wiki page from spellcheck issue:', err)
    }
  }, [content, escapeForRegex, onOpenWikiPage, refreshSpellcheckDictionary, wikiLinkHandlers])

  const handleInput = (e) => {
    // Extract content from contentEditable, preserving wiki link markers and
    // line breaks, using the shared serializeEditorDom helper.
    const editor = e.currentTarget
    const plainContent = serializeEditorDom(editor)

    setContent(plainContent)

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
    
    // Re-apply content after a brief idle delay.
    // We intentionally do not compare against editor.textContent here because
    // contenteditable block structure can omit logical line breaks in textContent.
    highlightTimerRef.current = setTimeout(() => {
      if (editorRef.current) {
        applyEditorContent(plainContent)
      }
      highlightTimerRef.current = null
    }, 500)
  }

  return (
    <div className="manuscript-inner">
      {popoverState && (
        <WikiLinkPopover
          type={popoverState.type}
          position={popoverState.position}
          data={popoverState.data}
          onSelectPage={handleSelectPage}
          onCreatePage={handleCreatePage}
          onClose={handleClosePopover}
        />
      )}
      {error && <div className="error-message">{error}</div>}
      <article
        className="editor"
        ref={editorRef}
        contentEditable
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onInput={handleInput}
        onBlur={handleEditorBlur}
        aria-busy={loading || isLoadingChapter}
        data-testid="manuscript-editor"
      />
      <section className="spellcheck-panel" data-testid="spellcheck-panel" aria-live="polite">
        <div className="spellcheck-panel-header">
          <strong>Spellcheck</strong>
          <span data-testid="spellcheck-status">
            {isSpellcheckLoading
              ? 'Refreshing dictionary...'
              : spellcheckIssues.length === 0
                ? 'No spelling issues'
                : `${spellcheckIssues.length} potential issue${spellcheckIssues.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="spellcheck-issues" data-testid="spellcheck-issues">
          {spellcheckIssues.map((issue) => (
            <div key={issue.word} className="spellcheck-issue-item" data-testid="spellcheck-issue-item">
              <span className="spellcheck-issue" data-testid="spellcheck-issue">{issue.word}</span>
              <div className="spellcheck-suggestions" data-testid="spellcheck-suggestions">
                {issue.suggestions.length > 0 ? issue.suggestions.map((suggestion) => (
                  <button
                    key={`${issue.word}-${suggestion}`}
                    type="button"
                    className="btn ghost spellcheck-suggestion"
                    data-testid="spellcheck-suggestion"
                    onClick={() => handleApplySpellcheckSuggestion(issue.word, suggestion)}
                  >
                    {suggestion}
                  </button>
                )) : (
                  <span className="spellcheck-no-suggestions" data-testid="spellcheck-no-suggestions">
                    No suggestions
                  </span>
                )}
                <button
                  type="button"
                  className="btn ghost spellcheck-create-wiki"
                  data-testid="spellcheck-create-wiki"
                  onClick={() => handleCreateWikiFromSpellcheckIssue(issue.word)}
                >
                  Create Wiki Page
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
