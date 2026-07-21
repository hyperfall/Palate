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

export function countWords(value: LexicalValue): number {
  const text = lexicalToPlainText(value)
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}
