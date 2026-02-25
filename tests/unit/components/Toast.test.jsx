import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast } from '../../../src/components/Toast';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when message is null', () => {
    const { container } = render(<Toast message={null} type="error" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render error toast with message', () => {
    render(<Toast message="Save failed" type="error" />);
    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });

  it('should render success toast with message', () => {
    render(<Toast message="Saved successfully" type="success" />);
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('should render info toast with message', () => {
    render(<Toast message="Saving..." type="info" />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('should call onClose when dismiss button clicked', async () => {
    const onClose = vi.fn();
    render(<Toast message="Test message" type="info" onClose={onClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    closeButton.click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-dismiss after duration', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    
    render(<Toast message="Auto dismiss" type="success" duration={3000} onClose={onClose} />);
    
    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    
    expect(onClose).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should apply correct CSS class for error type', () => {
    const { container } = render(<Toast message="Error" type="error" />);
    expect(container.querySelector('.toast-error')).toBeInTheDocument();
  });

  it('should apply correct CSS class for success type', () => {
    const { container } = render(<Toast message="Success" type="success" />);
    expect(container.querySelector('.toast-success')).toBeInTheDocument();
  });

  it('should not auto-dismiss if duration is not provided', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    
    render(<Toast message="No auto dismiss" type="info" onClose={onClose} />);
    
    vi.advanceTimersByTime(10000);
    
    expect(onClose).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
