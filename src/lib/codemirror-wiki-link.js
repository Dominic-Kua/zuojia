import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  MatchDecorator,
  PluginValue,
} from '@codemirror/view';
import { Range, StateEffect } from '@codemirror/state';
import { extractWikiLinks, resolveWikiLink } from './wiki-link';

/**
 * CodeMirror extension for wiki link syntax highlighting and interaction
 * Syntax: [[page-name]] or [[page-name|display text]]
 */

// StateEffect for updating wiki pages in the plugin
export const setWikiPages = StateEffect.define();

// Decoration for wiki links
const wikiLinkMark = Decoration.mark({
  class: 'wiki-link',
  attributes: {
    'data-wiki-link': 'true',
  },
});

class WikiLinkHighlighter extends PluginValue {
  decorations = Decoration.none;
  wikiPages = [];
  onLinkClick = null;
  onLinkHover = null;
  onCreatePage = null;

  constructor(view, wikiPages = [], handlers = {}) {
    super();
    this.wikiPages = wikiPages;
    this.onLinkClick = handlers.onLinkClick || (() => {});
    this.onLinkHover = handlers.onLinkHover || (() => {});
    this.onCreatePage = handlers.onCreatePage || (() => {});
    this.update(view);
  }

  update(update) {
    let recompute = update.docChanged || update.viewportChanged;
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(setWikiPages)) {
          this.wikiPages = effect.value;
          recompute = true;
        }
      }
    }
    if (recompute) {
      this.computeDecorations(update.view);
    }
  }

  computeDecorations(view) {
    const decorations = [];
    const content = view.state.doc.toString();
    const links = extractWikiLinks(content);

    for (const link of links) {
      const from = link.position;
      const to = from + link.raw.length;

      // Create a widget decoration for the link
      const linkWidget = document.createElement('span');
      linkWidget.className = 'wiki-link-widget';
      linkWidget.textContent = link.display;
      linkWidget.setAttribute('data-target', link.target);
      linkWidget.setAttribute('data-display', link.display);

      // Handle click
      linkWidget.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleLinkClick(link.target, link.display);
      });

      // Handle hover for preview
      linkWidget.addEventListener('mouseenter', () => {
        this.handleLinkHover(link.target);
      });

      decorations.push(
        wikiLinkMark.range(from, to),
        Decoration.widget({
          widget: linkWidget,
          side: 0,
        }).range(from)
      );
    }

    this.decorations = Decoration.set(decorations, true);
  }

  handleLinkClick(target, display) {
    const resolution = resolveWikiLink(target, this.wikiPages);

    if (resolution.found) {
      // Open the page
      this.onLinkClick({
        action: 'open',
        page: resolution.matches[0],
      });
    } else if (resolution.matches.length > 1) {
      // Show disambiguation menu
      this.onLinkClick({
        action: 'disambiguate',
        target,
        options: resolution.matches,
      });
    } else if (resolution.matches.length === 1) {
      // Single partial match - open it
      this.onLinkClick({
        action: 'open',
        page: resolution.matches[0],
      });
    } else {
      // Page doesn't exist - offer to create
      this.onLinkClick({
        action: 'create',
        target,
        display,
      });
    }
  }

  handleLinkHover(target) {
    const resolution = resolveWikiLink(target, this.wikiPages);
    if (resolution.found) {
      this.onLinkHover({
        page: resolution.matches[0],
      });
    }
  }
}

/**
 * Create wiki link extension for CodeMirror
 * @param {Array} wikiPages - Array of {slug, title, filepath, ...} objects
 * @param {Object} handlers - Event handlers {onLinkClick, onLinkHover, onCreatePage}
 * @returns {Extension}
 */
export function wikiLinkExtension(wikiPages = [], handlers = {}) {
  return [
    ViewPlugin.define(
      (view) => new WikiLinkHighlighter(view, wikiPages, handlers),
      {
        decorations: (instance) => instance.decorations,
      }
    ),
    EditorView.baseTheme({
      '.wiki-link': {
        color: '#0066cc',
        textDecoration: 'underline',
        cursor: 'pointer',
        fontWeight: '500',
      },
      '.wiki-link:hover': {
        backgroundColor: '#e6f2ff',
        borderRadius: '2px',
      },
      '.wiki-link-widget': {
        color: '#0066cc',
        textDecoration: 'underline',
        cursor: 'pointer',
        fontWeight: '500',
        padding: '0 2px',
      },
      '.wiki-link-widget:hover': {
        backgroundColor: '#e6f2ff',
        borderRadius: '2px',
      },
    }),
  ];
}

/**
 * Update wiki pages in the extension
 * @param {EditorView} view - CodeMirror view
 * @param {Array} newWikiPages - Updated wiki pages
 */
export function updateWikiPages(view, newWikiPages) {
  view.dispatch({ effects: setWikiPages.of(newWikiPages) });
}
