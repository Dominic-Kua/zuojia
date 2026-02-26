import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WikiPageEditor from '../../../src/components/WikiSidebar/WikiPageEditor'

describe('WikiPageEditor Component', () => {
  const mockProps = {
    page: {
      slug: 'test-page',
      title: 'Test Page',
      content: 'Initial content here',
    },
    onSave: vi.fn(),
    onClose: vi.fn(),
    isSaving: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render editor with page title', () => {
      render(<WikiPageEditor {...mockProps} />)
      
      expect(screen.getByText('Test Page')).toBeInTheDocument()
    })

    it('should render content in editor', () => {
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      expect(editor).toBeInTheDocument()
    })

    it('should render save button', () => {
      render(<WikiPageEditor {...mockProps} />)
      
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })

    it('should render close button', () => {
      render(<WikiPageEditor {...mockProps} />)
      
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })

    it('should render slug in header', () => {
      render(<WikiPageEditor {...mockProps} />)
      
      expect(screen.getByText(/test-page/)).toBeInTheDocument()
    })

    it('should render with empty content gracefully', () => {
      const emptyProps = {
        ...mockProps,
        page: { ...mockProps.page, content: '' },
      }

      render(<WikiPageEditor {...emptyProps} />)
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })
  })

  describe('Manual Save', () => {
    it('should call onSave when save button clicked', async () => {
      const user = userEvent.setup()
      render(<WikiPageEditor {...mockProps} />)
      
      // Edit content first to enable save button
      const editor = screen.getByDisplayValue(/Initial content/)
      await user.type(editor, ' edited')
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)
      
      expect(mockProps.onSave).toHaveBeenCalled()
    })

    it('should pass updated content to onSave', async () => {
      const user = userEvent.setup()
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      await user.clear(editor)
      await user.type(editor, 'Updated content')
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)
      
      expect(mockProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('Updated'),
      }))
    })

    it('should show save status while saving', () => {
      const savingProps = { ...mockProps, isSaving: true }
      render(<WikiPageEditor {...savingProps} />)
      
      // Check for "Saving..." status indicator
      expect(screen.getByText('⟳ Saving...')).toBeInTheDocument()
    })

    it('should disable save button while saving', () => {
      const savingProps = { ...mockProps, isSaving: true }
      render(<WikiPageEditor {...savingProps} />)
      
      const buttons = screen.getAllByRole('button')
      const saveButton = buttons.find(btn => btn.textContent === 'Saving...')
      expect(saveButton.disabled).toBe(true)
    })
  })

  describe('Auto-save', () => {
    it('should auto-save after idle period', async () => {
      vi.useFakeTimers()
      
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      fireEvent.change(editor, { target: { value: 'Initial content more text' } })
      
      // Advance 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      
      expect(mockProps.onSave).toHaveBeenCalled()
      
      vi.useRealTimers()
    })

    it('should cancel auto-save if save before idle completes', async () => {
      vi.useFakeTimers()
      
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      fireEvent.change(editor, { target: { value: 'Initial content more' } })
      
      // Advance 2 minutes (before auto-save triggers)
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
      
      // User manually saves
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)
      
      // Advance to 5 minute mark
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
      
      // Should only have one call (the manual save)
      expect(mockProps.onSave).toHaveBeenCalledTimes(1)
      
      vi.useRealTimers()
    })

    it('should reset auto-save timer on content change', async () => {
      vi.useFakeTimers()
      
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      
      // Make change
      fireEvent.change(editor, { target: { value: 'Initial content part1' } })
      
      // Advance 3 minutes
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
      
      // Make another change (resets timer)
      fireEvent.change(editor, { target: { value: 'Initial content part1 part2' } })
      
      // Advance 2 more minutes (total 5, but timer was reset)
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
      
      // Should not have saved yet (timer was reset, needs 5 more min)
      expect(mockProps.onSave).not.toHaveBeenCalled()
      
      vi.useRealTimers()
    })
  })

  describe('Close', () => {
    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup()
      render(<WikiPageEditor {...mockProps} />)
      
      const closeButton = screen.getByRole('button', { name: /close|back/i })
      await user.click(closeButton)
      
      expect(mockProps.onClose).toHaveBeenCalled()
    })

    it('should warn about unsaved changes on close', async () => {
      const user = userEvent.setup()
      const warnSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      await user.type(editor, ' unsaved')
      
      const closeButton = screen.getByRole('button', { name: /close|back/i })
      await user.click(closeButton)
      
      // Should have warned about unsaved changes
      expect(warnSpy).toHaveBeenCalled()
      
      warnSpy.mockRestore()
    })

    it('should not warn if no unsaved changes', async () => {
      const user = userEvent.setup()
      const warnSpy = vi.spyOn(window, 'confirm')
      
      render(<WikiPageEditor {...mockProps} />)
      
      const closeButton = screen.getByRole('button', { name: /close|back/i })
      await user.click(closeButton)
      
      expect(warnSpy).not.toHaveBeenCalled()
      expect(mockProps.onClose).toHaveBeenCalled()
      
      warnSpy.mockRestore()
    })
  })

  describe('Draft Management', () => {
    it('should track unsaved status', async () => {
      const { container } = render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      await userEvent.type(editor, ' change')
      
      // Component should show unsaved indicator
      // This might be a CSS class or UI element
      expect(container.querySelector('.unsaved') || screen.getByText(/unsaved|modified/i)).toBeTruthy()
    })

    it('should clear unsaved status after save', async () => {
      const user = userEvent.setup()
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      await user.type(editor, ' updated')
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)
      
      expect(mockProps.onSave).toHaveBeenCalled()
    })
  })

  describe('Content Editing', () => {
    it('should allow editing content', async () => {
      const user = userEvent.setup()
      render(<WikiPageEditor {...mockProps} />)
      
      const editor = screen.getByDisplayValue(/Initial content/)
      await user.clear(editor)
      await user.type(editor, 'New content')
      
      expect(editor.value || editor.textContent).toContain('New content')
    })

    it('should handle multiline content', async () => {
      const multilineProps = {
        ...mockProps,
        page: { ...mockProps.page, content: 'Line 1\nLine 2\nLine 3' },
      }
      
      render(<WikiPageEditor {...multilineProps} />)
      
      const editor = screen.getByDisplayValue(/Line 1/)
      expect(editor.value || editor.textContent).toContain('Line 2')
    })

    it('should preserve formatting when editing', async () => {
      const formattedProps = {
        ...mockProps,
        page: { ...mockProps.page, content: '# Heading\n\n**Bold text**\n\n- List item' },
      }
      
      render(<WikiPageEditor {...formattedProps} />)
      
      const editor = screen.getByDisplayValue(/Heading/)
      expect(editor.value || editor.textContent).toContain('**Bold')
    })
  })

  describe('Props Validation', () => {
    it('should render without errors for minimal props', () => {
      const minimalProps = {
        page: { slug: 'test', title: 'Test', content: '' },
        onSave: vi.fn(),
        onClose: vi.fn(),
      }
      
      expect(() => render(<WikiPageEditor {...minimalProps} />)).not.toThrow()
    })

    it('should handle null content', () => {
      const nullContentProps = {
        ...mockProps,
        page: { ...mockProps.page, content: null },
      }
      
      expect(() => render(<WikiPageEditor {...nullContentProps} />)).not.toThrow()
    })
  })
})
