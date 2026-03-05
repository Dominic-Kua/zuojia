import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChapterList } from './Navigation/ChapterList'
import { useChapters } from '../hooks/useChapters'
import { useWordCount } from '../hooks/useWordCount'
import { useWikiLinks } from '../hooks/useWikiLinks'
import { WikiLinkPopover } from './WikiLinkPopover'
import { indexHandlers } from '../lib/ipc-client'

const DEFAULT_CHAPTER_FILENAME = 'chapter-01.md'
const DEFAULT_CHAPTER_CONTENT = '# Chapter 1\n\nStart writing here...'
const CHAPTER_FILENAME_PATTERN = /^chapter-(\d+)\.md$/i

export default function Manuscript({ novelPath, wikiPages = [], onOpenWikiPage }){
  const editorRef = useRef(null)
  const saveTimerRef = useRef(null)
  const createdDefaultRef = useRef(false)

  const [content, setContent] = useState('')
  const [isLoadingChapter, setIsLoadingChapter] = useState(false)
  const [popoverState, setPopoverState] = useState(null)

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

  const { manuscriptCount, chapterCount, todayCount } = useWordCount(
    novelPath,
    currentChapter,
    content
  )

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
    if (editorRef.current) {
      editorRef.current.replaceChildren(highlightWikiLinks(nextContent || ''))
    }
  }, [highlightWikiLinks])

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

  const handleInput = (e) => {
    // Extract content from contentEditable, preserving wiki link markers and line breaks
    const editor = e.currentTarget
    let plainContent = ''

    const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'])

    const traverse = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        plainContent += node.textContent
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') {
          plainContent += '\n'
        } else if (node.classList.contains('wiki-link')) {
          const target = node.getAttribute('data-wiki-target')
          const display = node.getAttribute('data-wiki-display')
          plainContent += target === display ? `[[${target}]]` : `[[${target}|${display}]]`
        } else {
          // Insert newline before block-level elements (except at the very start)
          if (BLOCK_TAGS.has(node.tagName) && plainContent.length > 0 && !plainContent.endsWith('\n')) {
            plainContent += '\n'
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

    setContent(plainContent)
  }

  const handleBeforeSwitch = useCallback(async () => {
    if (!currentChapter || !novelPath) {
      return true
    }

    try {
      await saveChapter(currentChapter, content)
      return true
    } catch (err) {
      console.error('Failed to save before switching chapters:', err)
      return false
    }
  }, [content, currentChapter, novelPath, saveChapter])

  const handleCreateChapter = useCallback(async () => {
    if (!novelPath) {
      return
    }

    try {
      await handleBeforeSwitch()

      const existingNumbers = chapters
        .map((chapter) => {
          const match = chapter.filename.match(CHAPTER_FILENAME_PATTERN)
          return match ? Number(match[1]) : null
        })
        .filter((value) => Number.isInteger(value))

      const nextNumber = existingNumbers.length > 0
        ? Math.max(...existingNumbers) + 1
        : chapters.length + 1

      const paddedNumber = String(nextNumber).padStart(2, '0')
      const filename = `chapter-${paddedNumber}.md`
      const chapterTitle = `# Chapter ${nextNumber}\n\nStart writing here...`

      setIsLoadingChapter(true)
      await saveChapter(filename, chapterTitle)
      await indexHandlers.rebuildIndex(novelPath)
      await refresh()
      setCurrentChapter(filename)
      setContent(chapterTitle)
      applyEditorContent(chapterTitle)
    } catch (err) {
      console.error('Failed to create chapter:', err)
    } finally {
      setIsLoadingChapter(false)
    }
  }, [applyEditorContent, chapters, handleBeforeSwitch, novelPath, refresh, saveChapter, setCurrentChapter])

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
      <div className="manuscript-meta">
        <ChapterList
          chapters={chapters}
          currentChapter={currentChapter}
          onChapterSelect={setCurrentChapter}
          onBeforeSwitch={handleBeforeSwitch}
          onCreateChapter={handleCreateChapter}
          hasUnsavedChanges={false}
        />
        <div className="wordcounts">
          <span>Manuscript: {manuscriptCount.toLocaleString()}</span>
          <span>Open chapter: {chapterCount.toLocaleString()}</span>
          <span>Today: {todayCount.toLocaleString()}</span>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
      <article
        className="editor"
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={() => applyEditorContent(content)}
        aria-busy={loading || isLoadingChapter}
        data-testid="manuscript-editor"
      />
    </div>
  )
}
