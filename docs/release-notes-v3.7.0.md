# Release Notes: v3.7.0

## Summary

Version 3.7.0 adds a distraction-free focus mode for drafting, with an always-visible way back to the full workspace.

## Highlights

- Enter focus mode from the topbar `Focus` button or with `Ctrl/Cmd+Shift+F`.
- Focus mode hides the topbar, wiki pane (docked or floating), chapter tools, word counts, writing goals, and the spellcheck panel.
- The manuscript keeps its chapter, caret, and editing state; the saved split layout and floating wiki position are untouched and return when focus mode ends.
- Exit with the persistent `Exit focus` control in the top-right or with `Esc`. A short on-entry hint also explains both options.
- Works in light and dark themes and honours `prefers-reduced-motion`.
- Closing the novel leaves focus mode automatically.

## Validation

- Unit suite: 787 passed, 2 environment-dependent integration tests skipped.
- Helper suite: 326 passed.
- Focus mode E2E: 2 passed (chrome visibility, editing state, light/dark theme, reduced motion).
- Production renderer build succeeds.
