import { describe, expect, it } from 'vitest'

import { lexicalToParagraphs, lexicalToPlainText } from '@/lib/lexical'

const doc = {
  root: {
    children: [
      { type: 'paragraph', children: [{ text: 'First paragraph.' }] },
      { type: 'paragraph', children: [{ text: 'Second paragraph.' }] },
      { type: 'paragraph', children: [{ text: '' }] },
      { type: 'paragraph', children: [{ text: 'Third, after a blank.' }] },
    ],
  },
}

describe('lexicalToParagraphs', () => {
  it('keeps paragraphs apart instead of welding them into one wall', () => {
    expect(lexicalToParagraphs(doc as never)).toEqual([
      'First paragraph.',
      'Second paragraph.',
      'Third, after a blank.',
    ])
  })

  it('drops empty blocks rather than emitting blank paragraphs', () => {
    const spaced = { root: { children: [{ type: 'paragraph', children: [{ text: '   ' }] }] } }
    expect(lexicalToParagraphs(spaced as never)).toEqual([])
  })

  it('survives empty and missing content', () => {
    expect(lexicalToParagraphs(null as never)).toEqual([])
    expect(lexicalToParagraphs({ root: { children: [] } } as never)).toEqual([])
  })
})

describe('lexicalToPlainText', () => {
  it('still flattens to one line, because a meta description must be', () => {
    // The paragraph-preserving version exists precisely so this one can stay
    // single-line; if this ever gains newlines, metadata breaks.
    expect(lexicalToPlainText(doc as never)).toBe(
      'First paragraph. Second paragraph. Third, after a blank.',
    )
  })
})
