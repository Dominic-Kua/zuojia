import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChapterList } from './Navigation/ChapterList'
import { useChapters } from '../hooks/useChapters'
import { useWordCount } from '../hooks/useWordCount'
import { indexHandlers } from '../lib/ipc-client'

const DEFAULT_CHAPTER_FILENAME = 'chapter-01.md'
const DEFAULT_CHAPTER_CONTENT = '# Chapter 1\n\nStart writing here...'
const CHAPTER_FILENAME_PATTERN = /^chapter-(\d+)\.md$/i

export default function Manuscript({ novelPath }){
  const editorRef = useRef(null)
  const saveTimerRef = useRef(null)
  const createdDefaultRef = useRef(false)

  const [content, setContent] = useState('')
  const [isLoadingChapter, setIsLoadingChapter] = useState(false)

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

  const applyEditorContent = useCallback((nextContent) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = nextContent || ''
    }
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
    setContent(e.currentTarget.innerHTML)
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
        aria-busy={loading || isLoadingChapter}
      />
    </div>
  )
}
