ä½å®¶ Style Guide — MVP (macOS)
=================================

Intent: Clean, comfortable, soft-toned UI with a clear serif font for long-form reading and composition.

1) Typography
- Primary (body / manuscript): Merriweather, serif; fallback: Georgia, serif
- UI / Labels: Inter, system sans-serif; fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI'
- Sizes (base = 16px):
  - Body / manuscript text: 18px
  - UI labels / sidebar text: 14px
  - Headings: H1 28px, H2 20px, H3 16px

Use generous line-height for manuscript: 1.6. Letter-spacing: 0 for body, 0.02em for UI labels.

2) Color Palette (soft, warm neutrals + muted accent)
- Background (app shell): #F7F6F3 (Soft cream)
- Manuscript surface: #FFFFFF (Paper white)
- Sidebar surface: #F2F4F3 (Very light sage)
- Primary text: #1F2933 (Charcoal)
- Secondary text: #586069 (Muted gray)
- Accent (action / highlights): #6E9A8F (Muted teal)
- Accent muted (subtle UI): #C7D6D1
- Error / inline spell: #C94C4C (gentle red)
- Divider / subtle borders: rgba(30,41,50,0.06)

3) Spacing & Layout Tokens
- Base spacing unit: 8px
- Gutters: manuscript-padding 32px; sidebar-padding 20px
- Container max-width (manuscript column): 980px (centered column inside 3/4 area)

4) Elevation & Shadows
- Very soft shadow for floating panels: 0 6px 18px rgba(32,38,40,0.06)
- No heavy drop-shadows — keep interface flat and calm.

5) Interaction & Microcopy
- Button style: rounded 8px, background accent for primary actions, neutral ghost for secondary
- Commit / Snapshot button: clear icon + text, small confirmation toast
- Inline spell suggestions: subtle dotted underline + context menu to accept/ignore

6) Accessibility
- Ensure 4.5:1 contrast for primary text on background where possible
- Keyboard navigation for sidebar items and quick-toggle for word-count views
- Provide font-size scaling in Settings

7) Assets & Fonts
- Use Google Fonts for Merriweather + Inter in prototype; for macOS native distribution, prefer bundling fonts or using system variants.
