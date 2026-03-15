import React, { useEffect } from 'react';

/**
 * App-level toast notification.
 * Auto-dismisses after `duration` ms.
 *
 * @param {{ message: string, type: 'success'|'error'|'info' }} toast
 * @param {function} onDismiss - Called when the toast should be hidden
 * @param {number} [duration=3000]
 */
export function Toast({ toast, onDismiss, duration = 3000 }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;

  return (
    <div
      className={`toast toast-${toast.type}`}
      data-testid="toast"
      role="status"
      aria-live="polite"
    >
      <span data-testid="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        data-testid="toast-close"
        onClick={onDismiss}
        type="button"
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  );
}
