import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { WikiLinkPreview } from '../../../src/components/WikiLinkPreview/index.jsx'

describe('WikiLinkPreview Component', () => {
  describe('Preview Content Rendering', () => {
    it('should render preview with page content', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Character"
          pageContent="Alice is the protagonist..."
          position={{ x: 100, y: 200 }}
        />
      )
      expect(container.querySelector('.wiki-preview')).toBeInTheDocument()
    })

    it('should truncate content to 100 characters', () => {
      const longContent = 'a'.repeat(150)
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent={longContent}
          position={{ x: 100, y: 200 }}
        />
      )
      const content = container.querySelector('.wiki-preview-content')
      expect(content.textContent.length).toBeLessThanOrEqual(105)
    })

    it('should show ellipsis for truncated content', () => {
      const longContent = 'a'.repeat(150)
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent={longContent}
          position={{ x: 100, y: 200 }}
        />
      )
      const content = container.querySelector('.wiki-preview-content')
      expect(content.textContent).toContain('...')
    })

    it('should display page name in title', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="MyLocation"
          pageContent="Location content"
          position={{ x: 100, y: 200 }}
        />
      )
      const title = container.querySelector('.wiki-preview-title')
      expect(title.textContent).toBe('MyLocation')
    })

    it('should not truncate short content', () => {
      const shortContent = 'Short text'
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent={shortContent}
          position={{ x: 100, y: 200 }}
        />
      )
      const content = container.querySelector('.wiki-preview-content')
      expect(content.textContent).toBe('Short text')
    })
  })

  describe('Not Found State', () => {
    it('should show not-found message', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="NonExistent"
          isNotFound={true}
          position={{ x: 100, y: 200 }}
        />
      )
      const notFound = container.querySelector('.wiki-preview-not-found-msg')
      expect(notFound).toBeInTheDocument()
    })

    it('should apply not-found styling', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Missing"
          isNotFound={true}
          position={{ x: 100, y: 200 }}
        />
      )
      const preview = container.querySelector('.wiki-preview')
      expect(preview.classList.contains('wiki-preview-not-found')).toBe(true)
    })
  })

  describe('Loading State', () => {
    it('should show loading indicator', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          isLoading={true}
          position={{ x: 100, y: 200 }}
        />
      )
      const loading = container.querySelector('.wiki-preview-loading-indicator')
      expect(loading).toBeInTheDocument()
    })

    it('should apply loading styling', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          isLoading={true}
          position={{ x: 100, y: 200 }}
        />
      )
      const preview = container.querySelector('.wiki-preview')
      expect(preview.classList.contains('wiki-preview-loading')).toBe(true)
    })
  })

  describe('Positioning', () => {
    it('should apply fixed positioning', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent="Content"
          position={{ x: 150, y: 250 }}
        />
      )
      const wrapper = container.querySelector('.wiki-preview-wrapper')
      expect(wrapper.style.left).toBe('150px')
      expect(wrapper.style.top).toBe('250px')
    })

    it('should update position when props change', () => {
      const { rerender, container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent="Content"
          position={{ x: 100, y: 100 }}
        />
      )
      expect(container.querySelector('.wiki-preview-wrapper').style.left).toBe('100px')

      rerender(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent="Content"
          position={{ x: 200, y: 300 }}
        />
      )
      expect(container.querySelector('.wiki-preview-wrapper').style.left).toBe('200px')
    })
  })

  describe('Visibility', () => {
    it('should not show preview content when not visible', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={false}
          pageName="Page"
          pageContent="Content"
        />
      )
      const preview = container.querySelector('.wiki-preview')
      expect(preview).not.toBeInTheDocument()
    })

    it('should show preview when visible', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent="Content"
        />
      )
      const preview = container.querySelector('.wiki-preview')
      expect(preview).toBeInTheDocument()
    })

    it('should have hidden class when not visible', () => {
      const { container } = render(
        <WikiLinkPreview isVisible={false} />
      )
      const wrapper = container.querySelector('.wiki-preview-wrapper')
      expect(wrapper.classList.contains('wiki-preview-hidden')).toBe(true)
    })
  })

  describe('Dark Theme', () => {
    it('should apply dark theme class', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          pageContent="Content"
          isDarkTheme={true}
        />
      )
      const preview = container.querySelector('.wiki-preview')
      expect(preview.classList.contains('wiki-preview-dark')).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should show error message', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          isError={true}
          errorMessage="Failed to load"
        />
      )
      const error = container.querySelector('.wiki-preview-error-msg')
      expect(error).toBeInTheDocument()
    })

    it('should apply error styling', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
          isError={true}
        />
      )
      const preview = container.querySelector('.wiki-preview')
      expect(preview.classList.contains('wiki-preview-error')).toBe(true)
    })
  })

  describe('Props Validation', () => {
    it('should handle empty page name gracefully', () => {
      expect(() => {
        render(
          <WikiLinkPreview
            isVisible={true}
            pageName=""
            pageContent="Content"
          />
        )
      }).not.toThrow()
    })

    it('should handle null content gracefully', () => {
      expect(() => {
        render(
          <WikiLinkPreview
            isVisible={true}
            pageName="Page"
            pageContent={null}
          />
        )
      }).not.toThrow()
    })

    it('should render with minimal props', () => {
      expect(() => {
        render(<WikiLinkPreview />)
      }).not.toThrow()
    })

    it('should show empty state for no content', () => {
      const { container } = render(
        <WikiLinkPreview
          isVisible={true}
          pageName="Page"
        />
      )
      const emptyState = container.querySelector('.wiki-preview-empty')
      expect(emptyState).toBeInTheDocument()
    })
  })
})
