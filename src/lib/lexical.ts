/**
 * Minimal helpers for reading Lexical rich-text values outside the editor.
 * Payload stores Lexical as a nested JSON tree; we only ever need the plain
 * text out of it (word caps, meta descriptions, JSON-LD).
 */

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
}

export type LexicalValue = { root?: LexicalNode } | null | undefined

export function lexicalToPlainText(value: LexicalValue): string {
  const root = value?.root
  if (!root) return ''

  const parts: string[] = []
  const walk = (node: LexicalNode) => {
    if (typeof node.text === 'string') parts.push(node.text)
    node.children?.forEach(walk)
    // Treat block-level nodes as sentence boundaries so words don't run together.
    if (node.type === 'paragraph' || node.type === 'heading') parts.push('\n')
  }
  walk(root)

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * The same content, kept as separate paragraphs.
 *
 * `lexicalToPlainText` inserts a break at every block boundary and then its
 * final `\s+` collapse destroys them — correct for a meta description, which
 * must be one line, and wrong for the page, where a three-paragraph story was
 * rendering as a single undifferentiated wall. Display uses this; metadata
 * keeps the flattened form.
 */
export function lexicalToParagraphs(value: LexicalValue): string[] {
  const root = value?.root
  if (!root) return []

  const out: string[] = []
  let current: string[] = []
  const flush = () => {
    const text = current.join(' ').replace(/\s+/g, ' ').trim()
    if (text) out.push(text)
    current = []
  }

  const walk = (node: LexicalNode) => {
    if (typeof node.text === 'string') current.push(node.text)
    node.children?.forEach(walk)
    // A block ends the paragraph being gathered rather than adding whitespace
    // that a later collapse can eat.
    if (node.type === 'paragraph' || node.type === 'heading') flush()
  }
  walk(root)
  flush()

  return out
}

export function countWords(value: LexicalValue): number {
  const text = lexicalToPlainText(value)
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Build a minimal, valid Lexical editor state from plain text — for the studio
 * form, where creators type a story in a textarea rather than the rich editor.
 * Blank lines split paragraphs. Returns null for empty input so the field stays
 * unset rather than storing an empty document.
 */
export function plainTextToLexical(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return null
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: paragraphs.map((p) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        children: [
          { type: 'text', text: p, format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
        ],
      })),
    },
  }
}
