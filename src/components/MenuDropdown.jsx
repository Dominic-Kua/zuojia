import React, { useEffect, useId, useRef, useState } from 'react';

export function MenuDropdown({
  label,
  testId,
  align = 'left',
  children,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className={`app-menu${className ? ` ${className}` : ''}`} ref={rootRef} data-testid={testId ? `${testId}-root` : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="btn ghost app-menu-trigger"
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      <div
        id={menuId}
        className={`app-menu-panel${align === 'right' ? ' right' : ''}`}
        role="menu"
        aria-label={label}
        aria-hidden={!open}
        hidden={!open}
        data-testid={testId ? `${testId}-panel` : undefined}
        onClick={(event) => {
          if (!open) return;
          // Close after activating a plain menu action, but keep mounted dialog
          // components stable and keep controls usable inside the panel.
          const keepOpen = event.target.closest('input, select, textarea, [data-menu-keep-open="true"], [data-menu-dialog-trigger="true"]');
          const action = event.target.closest('[data-menu-close="true"], a[href]');
          if (!keepOpen && action) closeMenu();
        }}
      >
        {children}
      </div>
    </div>
  );
}
