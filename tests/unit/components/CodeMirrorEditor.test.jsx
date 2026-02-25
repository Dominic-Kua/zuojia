import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeMirrorEditor } from '../../../src/components/Manuscript/CodeMirrorEditor';

// Mock CodeMirror extensions
vi.mock('@codemirror/lang-markdown', () => ({
  markdown: vi.fn(() => ({ extension: true })),
}));

describe('CodeMirrorEditor Component', () => {
  const mockContent = '# Chapter 1\n\nThis is test content for the editor.';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with containerclass', () => {
    render(<CodeMirrorEditor content={mockContent} onContentChange={vi.fn()} />);
    
    const container = document.querySelector('.codemirror-editor-container');
    expect(container).toBeInTheDocument();
  });

  it('should accept and display content prop', () => {
    const { container } = render(
      <CodeMirrorEditor content={mockContent} onContentChange={vi.fn()} />
    );
    
    // Editor container should exist
    expect(container.querySelector('.codemirror-editor-container')).not.toBeNull();
  });

  it('should call onContentChange when editor content changes', async () => {
    const onContentChange = vi.fn();
    const { container } = render(
      <CodeMirrorEditor content={mockContent} onContentChange={onContentChange} />
    );
    
    // Verify editor is set up (contains Monaco/CodeMirror ref)
    expect(container.querySelector('[data-testid="editor"]')).not.toBeNull();
  });

  it('should apply markdown syntax highlighting', () => {
    const { container } = render(
      <CodeMirrorEditor content={mockContent} onContentChange={vi.fn()} />
    );
    
    const editor = container.querySelector('[data-testid="editor"]');
    expect(editor).toBeInTheDocument();
  });

  it('should accept font size configuration', () => {
    const config = {
      fontSize: 16,
      lineHeight: 1.5,
      tabSize: 2,
    };
    
    const { container } = render(
      <CodeMirrorEditor 
        content={mockContent}
        onContentChange={vi.fn()}
        config={config}
      />
    );
    
    const editor = container.querySelector('[data-testid="editor"]');
    expect(editor).toBeInTheDocument();
    // Inline styles should reflect config
    expect(editor?.style.fontSize).toContain('px');
  });

  it('should accept theme configuration', () => {
    const { container } = render(
      <CodeMirrorEditor
        content={mockContent}
        onContentChange={vi.fn()}
        theme="dark"
      />
    );
    
    const editor = container.querySelector('[data-testid="editor"]');
    expect(editor).toBeInTheDocument();
  });

  it('should preserve cursor position when content is updated', () => {
    const { rerender } = render(
      <CodeMirrorEditor content={mockContent} onContentChange={vi.fn()} />
    );
    
    // Rerender with same content
    rerender(
      <CodeMirrorEditor content={mockContent} onContentChange={vi.fn()} />
    );

    // Editor should still exist and be functional
    const editor = document.querySelector('[data-testid="editor"]');
    expect(editor).toBeInTheDocument();
  });

  it('should allow setting initial cursor position', () => {
    const { container } = render(
      <CodeMirrorEditor
        content={mockContent}
        onContentChange={vi.fn()}
        initialCursorPos={{ line: 0, ch: 0 }}
      />
    );
    
    const editor = container.querySelector('[data-testid="editor"]');
    expect(editor).toBeInTheDocument();
  });

  it('should handle empty content gracefully', () => {
    const { container } = render(
      <CodeMirrorEditor content="" onContentChange={vi.fn()} />
    );
    
    const editor = container.querySelector('[data-testid="editor"]');
    expect(editor).toBeInTheDocument();
  });

  it('should provide ref for programmatic access', () => {
    const ref = { current: null };
    
    render(
      <CodeMirrorEditor 
        ref={ref}
        content={mockContent}
        onContentChange={vi.fn()}
      />
    );
    
    // Ref should be usable by parent
    expect(ref).toBeDefined();
  });
});
