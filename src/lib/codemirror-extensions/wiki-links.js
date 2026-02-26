import { parseWikiLinks, resolveSlug } from '../wiki-link-parser.js'
import { StateField } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'

/**
 * Creates a CodeMirror extension for wiki link detection, highlighting, and interaction
 * @param {Object} options Configuration object
 * @param {Function} options.onLinkClick Callback when wiki link is clicked (pageName, event) - required
 * @param {Function} options.onLinkHover Callback when hovering over link (pageName, position, isEnter) - optional
 * @param {Function} options.getPages Callback to get list of available wiki page names - required
 * @returns {Extension} CodeMirror extension
 */
export function wikiLinksExtension(options) {
  const { onLinkClick, onLinkHover, getPages } = options

  // Validate required callbacks
  if (typeof onLinkClick !== 'function') {
    throw new Error('wikiLinksExtension: onLinkClick callback is required')
  }
  if (typeof getPages !== 'function') {
    throw new Error('wikiLinksExtension: getPages callback is required')
  }

  // Decoration classes
  const validLinkDecoration = Decoration.mark({ class: 'wiki-link-valid' })
  const brokenLinkDecoration = Decoration.mark({ class: 'wiki-link-broken' })

  /**
   * StateField to track parsed links and decorations
   * Stores: { links: [...], decorations: DecorationSet }
   */
  const wikiLinksField = StateField.define({
    create() {
      return {
        links: [],
        decorations: DecorationSet.empty,
      }
    },

    update(fieldState, tr) {
      if (!tr.docChanged) return fieldState

      const availablePages = getPages()
      const pageSet = new Set(availablePages.map(p => resolveSlug(p)))

      const text = tr.state.doc.toString()
      const links = parseWikiLinks(text)

      const decorationArray = []
      links.forEach(link => {
        const { start, end, pageName } = link
        const slug = resolveSlug(pageName)
        const isValid = pageSet.has(slug)
        const decoration = isValid ? validLinkDecoration : brokenLinkDecoration
        decorationArray.push(decoration.range(start, end))
      })

      return {
        links,
        decorations: DecorationSet.from(decorationArray),
      }
    },
  })

  /**
   * ViewPlugin for handling click and hover interactions
   */
  const interactionPlugin = EditorView.domEventHandlers({
    mousedown(event, view) {
      const isCmdClick = event.metaKey || event.ctrlKey
      if (!isCmdClick || event.button !== 0) return false

      try {
        const pos = view.posAtDOM(event.target)
        const fieldState = view.state.field(wikiLinksField)
        const links = fieldState.links

        for (const link of links) {
          if (pos >= link.start && pos < link.end) {
            onLinkClick(link.pageName, event)
            return true
          }
        }
      } catch (e) {
        // Position calculation or field access failed
      }

      return false
    },

    mouseover(event, view) {
      if (!onLinkHover) return false

      try {
        const target = event.target
        if (target.nodeType !== 1) return false // Not an element

        const isWikiLink = 
          target.classList.contains('wiki-link-valid') || 
          target.classList.contains('wiki-link-broken')
        
        if (!isWikiLink) return false

        const pos = view.posAtDOM(target)
        const fieldState = view.state.field(wikiLinksField)
        const links = fieldState.links

        for (const link of links) {
          if (pos >= link.start && pos < link.end) {
            onLinkHover(link.pageName, { x: event.clientX, y: event.clientY }, true)
            return true
          }
        }
      } catch (e) {
        // Ignore errors on hover
      }

      return false
    },

    mouseout(event, view) {
      if (!onLinkHover) return false

      try {
        const target = event.target
        if (target.nodeType !== 1) return false

        const isWikiLink = 
          target.classList.contains('wiki-link-valid') || 
          target.classList.contains('wiki-link-broken')
        
        if (!isWikiLink) return false

        onLinkHover(null, null, false)
        return true
      } catch (e) {
        // Ignore errors
      }

      return false
    },
  })

  return [
    wikiLinksField,
    EditorView.decorations.compute([wikiLinksField], state => {
      return state.field(wikiLinksField).decorations
    }),
    interactionPlugin,
  ]
}

export default wikiLinksExtension
