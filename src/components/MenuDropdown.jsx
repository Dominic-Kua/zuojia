import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export function MenuDropdown({
  label,
  testId,
  align = 'left',
  children,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [resolvedAlign, setResolvedAlign] = useState(align);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open) {
      setResolvedAlign(align);
      return;
    }

    const updateAlign = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const triggerRect = trigger.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || 220;
      const padding = 8;
      const overflowsRight = triggerRect.left + panelWidth > window.innerWidth - padding;
      const overflowsLeft = triggerRect.right - panelWidth < padding;
      if (overflowsRight && !overflowsLeft) setResolvedAlign('right');
      else if (overflowsLeft && !overflowsRight) setResolvedAlign('left');
      else setResolvedAlign(align);
    };

    updateAlign();
    window.addEventListener('resize', updateAlign);
    return () => window.removeEventListener('resize', updateAlign);
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      if (!rootRef.current?.contains(event.target)) return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(
        panel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement);
      let next = 0;
      if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
      else if (event.key === 'ArrowUp') next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
      else if (event.key === 'Home') next = 0;
      else next = items.length - 1;
      event.preventDefault();
      items[next]?.focus();
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
        ref={panelRef}
        id={menuId}
        className={`app-menu-panel${resolvedAlign === 'right' ? ' right' : ''}`}
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
