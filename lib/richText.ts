// Helpers for the planner's rich-text notes.
//
// Notes are stored in `section_content.content` as HTML. Notes written before
// the rich-text editor existed are plain text, so everything here tolerates
// both: `toEditorHtml` upgrades legacy plain text (preserving line breaks),
// and `htmlToPlain` gives plain text back for previews, word counts and search.

const HTML_TAG = /<\/?(p|br|ul|ol|li|strong|b|em|i|u|s|h[1-6]|blockquote|code|pre|div|span)\b[^>]*>/i

/** Does this stored value already look like editor HTML? */
export function isHtml(value: string): boolean {
  return HTML_TAG.test(value || '')
}

/** Escape text for safe interpolation into note HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Convert a stored value into HTML the editor can load, preserving legacy line breaks. */
export function toEditorHtml(value: string | null | undefined): string {
  const v = value || ''
  if (!v.trim()) return ''
  if (isHtml(v)) return v
  // Legacy plain text: blank lines split paragraphs, single newlines become <br>
  return v
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Plain text for previews, word counts, status and search. Safe on both formats. */
export function htmlToPlain(value: string | null | undefined): string {
  const v = value || ''
  if (!v) return ''
  if (!isHtml(v)) return v
  if (typeof window === 'undefined') {
    return v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const doc = new DOMParser().parseFromString(
    v.replace(/<\/(p|li|h[1-6]|blockquote)>/gi, '</$1>\n').replace(/<br\s*\/?>/gi, '\n'),
    'text/html'
  )
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

/** True when a note has no real content (handles the editor's empty `<p></p>`). */
export function isEmptyNote(value: string | null | undefined): boolean {
  return htmlToPlain(value).trim().length === 0
}

// ── PDF rendering support ─────────────────────────────────────────────

export type InlineRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean }
export type Block = { type: 'p' | 'li'; marker?: string; runs: InlineRun[] }

/**
 * Flatten note HTML into blocks of styled inline runs so the PDF export can
 * render bold/italic/underline and list markers rather than raw tags.
 */
export function htmlToBlocks(value: string | null | undefined): Block[] {
  const v = value || ''
  if (!v.trim()) return []
  if (!isHtml(v)) {
    return v.split(/\n/).filter(l => l.trim()).map(line => ({ type: 'p' as const, runs: [{ text: line }] }))
  }
  if (typeof window === 'undefined') return []

  const doc = new DOMParser().parseFromString(v, 'text/html')
  const blocks: Block[] = []

  const collectRuns = (node: Node, style: InlineRun, out: InlineRun[]) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || ''
        if (text) out.push({ ...style, text })
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const el = child as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') { out.push({ ...style, text: '\n' }); return }
      collectRuns(el, {
        ...style,
        bold: style.bold || tag === 'strong' || tag === 'b',
        italic: style.italic || tag === 'em' || tag === 'i',
        underline: style.underline || tag === 'u',
      } as InlineRun, out)
    })
  }

  const walk = (node: Node, listMarker?: (i: number) => string, depth = 0) => {
    node.childNodes.forEach(child => {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        // Stray text directly in the body
        const text = (child.textContent || '').trim()
        if (text) blocks.push({ type: 'p', runs: [{ text }] })
        return
      }
      const el = child as HTMLElement
      const tag = el.tagName.toLowerCase()

      if (tag === 'ul' || tag === 'ol') {
        let index = 0
        el.childNodes.forEach(li => {
          if (li.nodeType !== Node.ELEMENT_NODE) return
          if ((li as HTMLElement).tagName.toLowerCase() !== 'li') return
          index += 1
          const runs: InlineRun[] = []
          collectRuns(li, {} as InlineRun, runs)
          if (runs.length) {
            blocks.push({
              type: 'li',
              marker: tag === 'ol' ? `${index}.` : '•',
              runs,
            })
          }
        })
        return
      }

      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'div'].includes(tag)) {
        const runs: InlineRun[] = []
        const heading = /^h[1-6]$/.test(tag)
        collectRuns(el, (heading ? { bold: true } : {}) as InlineRun, runs)
        if (runs.some(r => r.text.trim())) blocks.push({ type: 'p', runs })
        return
      }

      // Anything else: treat its text as a paragraph
      const runs: InlineRun[] = []
      collectRuns(el, {} as InlineRun, runs)
      if (runs.some(r => r.text.trim())) blocks.push({ type: 'p', runs })
    })
  }

  walk(doc.body)
  return blocks
}
