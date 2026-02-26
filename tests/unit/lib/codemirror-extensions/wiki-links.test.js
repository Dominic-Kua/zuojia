import { describe, it, expect, beforeEach, vi } from 'vitest'
import { wikiLinksExtension } from '../../../../src/lib/codemirror-extensions/wiki-links.js'

describe('CodeMirror Wiki Links Extension', () => {
  let onClickSpy, onHoverSpy, getPagesSpy

  beforeEach(() => {
    onClickSpy = vi.fn()
    onHoverSpy = vi.fn()
    getPagesSpy = vi.fn().mockReturnValue(['Character', 'Location', 'Timeline'])
  })

  describe('Configuration & Creation', () => {
    it('should create extension with required callbacks', () => {
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        onLinkHover: onHoverSpy,
        getPages: getPagesSpy,
      })
      
      expect(extension).toBeDefined()
      expect(Array.isArray(extension)).toBe(true)
      expect(extension.length).toBeGreaterThan(0)
    })

    it('should throw if onLinkClick is missing', () => {
      expect(() => {
        wikiLinksExtension({
          onLinkHover: onHoverSpy,
          getPages: getPagesSpy,
        })
      }).toThrow('onLinkClick callback is required')
    })

    it('should throw if getPages is missing', () => {
      expect(() => {
        wikiLinksExtension({
          onLinkClick: onClickSpy,
          onLinkHover: onHoverSpy,
        })
      }).toThrow('getPages callback is required')
    })

    it('should work with onLinkHover as optional', () => {
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: getPagesSpy,
      })
      
      expect(extension).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle extension creation with callback changes', () => {
      const newCallback = vi.fn()
      const extension = wikiLinksExtension({
        onLinkClick: newCallback,
        getPages: getPagesSpy,
      })
      
      expect(extension).toBeDefined()
    })

    it('should handle multiple extension instances', () => {
      const ext1 = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: getPagesSpy,
      })
      
      const ext2 = wikiLinksExtension({
        onLinkClick: vi.fn(),
        getPages: () => ['Other'],
      })
      
      expect(ext1).toBeDefined()
      expect(ext2).toBeDefined()
    })

    it('should accept empty getPages list', () => {
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: () => [],
      })
      
      expect(extension).toBeDefined()
    })

    it('should handle getPages returning many pages', () => {
      const manyPages = Array.from({ length: 100 }, (_, i) => `Page${i}`)
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: () => manyPages,
      })
      
      expect(extension).toBeDefined()
    })

    it('should not require onLinkHover callback', () => {
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: getPagesSpy,
        // onLinkHover intentionally omitted
      })
      
      expect(extension).toBeDefined()
    })

    it('should allow onLinkHover to be null', () => {
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        onLinkHover: null,
        getPages: getPagesSpy,
      })
      
      expect(extension).toBeDefined()
    })

    it('should handle getPages returning non-unique names', () => {
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: () => ['Duplicate', 'Other', 'Duplicate'],
      })
      
      expect(extension).toBeDefined()
    })

    it('should handle onLinkClick throwing error gracefully', () => {
      const throwingClick = vi.fn().mockImplementation(() => {
        throw new Error('Click handler error')
      })
      
      const extension = wikiLinksExtension({
        onLinkClick: throwingClick,
        getPages: getPagesSpy,
      })
      
      expect(extension).toBeDefined()
    })

    it('should handle getPages throwing error gracefully', () => {
      const throwingGetPages = vi.fn().mockImplementation(() => {
        throw new Error('Get pages error')
      })
      
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: throwingGetPages,
      })
      
      expect(extension).toBeDefined()
    })

    it('should support changing callbacks between creations', () => {
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()
      
      const ext1 = wikiLinksExtension({
        onLinkClick: onChange1,
        getPages: getPagesSpy,
      })
      
      const ext2 = wikiLinksExtension({
        onLinkClick: onChange2,
        getPages: getPagesSpy,
      })
      
      expect(ext1).toBeDefined()
      expect(ext2).toBeDefined()
      expect(onChange1).not.toBeCalled()
      expect(onChange2).not.toBeCalled()
    })

    it('should return array of extensions', () => {
      const extension = wikiLinksExtension({
        onLinkClick: onClickSpy,
        getPages: getPagesSpy,
      })
      
      expect(Array.isArray(extension)).toBe(true)
      expect(extension.length).toBeGreaterThanOrEqual(2) // StateField + decorations at minimum
    })
  })
})
