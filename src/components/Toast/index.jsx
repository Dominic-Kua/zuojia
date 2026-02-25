import React, { useEffect } from 'react';
import './Toast.css';

/**
 * Toast notification component
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'error' | 'success' | 'info'
 * @param {function} onClose - Callback when toast is dismissed
 * @param {number} duration - Auto-dismiss duration in ms (optional)
 */
export const Toast = ({ message, type = 'info', onClose, duration }) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!message) {
    return null;
  }

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '✕';
      case 'success':
        return '✓';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`toast toast-${type}`} role="alert">
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{message}</span>
      {onClose && (
        <button 
          className="toast-close" 
          onClick={onClose}
          aria-label="Close notification"
        >
          ×
        </button>
      )}
    </div>
  );
};
