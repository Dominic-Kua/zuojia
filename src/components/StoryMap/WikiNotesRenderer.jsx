import React, { useEffect, useMemo, useRef } from 'react';
import { normalizeSlug } from '../../lib/wiki-link';

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderWikiLinks(text, wikiPages) {
  const slugs = new Set((wikiPages || []).map((p) => p.slug));
  return escapeHtml(text || '').replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, page, _, label) => {
    const pageName = page.trim();
    if (!pageName) return match;
    const displayText = (label || pageName).trim();
    const slug = normalizeSlug(pageName);
    const isBroken = !slugs.has(slug);
    return `<a href="#" class="wiki-link${isBroken ? ' wiki-link-broken' : ''}" data-wiki-link="${slug}">${escapeHtml(displayText)}</a>`;
  });
}

export function WikiNotesRenderer({ text, wikiPages, onOpenWikiPage }) {
  const ref = useRef(null);
  const html = useMemo(() => renderWikiLinks(text, wikiPages), [text, wikiPages]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    function handleClick(event) {
      const link = event.target.closest('[data-wiki-link]');
      if (!link) return;
      event.preventDefault();
      onOpenWikiPage(link.dataset.wikiLink);
    }
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [onOpenWikiPage, text]);

  if (!text || !/\[\[/.test(text)) return null;

  return (
    <div
      ref={ref}
      className="scene-notes-wiki-rendered"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
