import { describe, expect, it } from 'vitest'

import {
  CONTENTS_MIN_WORDS,
  deservesContents,
  headingId,
  outlineOf,
  readingTime,
} from '@/lib/storyOutline'

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ')

describe('readingTime', () => {
  it('says "under a minute" rather than "0 min read"', () => {
    // A rounded zero reads as a bug, and most recipe notes are this short.
    expect(readingTime('a short note about the dish')).toBe('Under a minute')
  })

  it('rounds longer stories to whole minutes', () => {
    expect(readingTime(words(400))).toBe('2 min read')
    expect(readingTime(words(1000))).toBe('5 min read')
  })

  it('says nothing at all for nothing at all', () => {
    expect(readingTime('')).toBe('')
    expect(readingTime('   ')).toBe('')
  })
})

describe('outlineOf', () => {
  it('collects h2 and h3 in document order, ignoring h1 and h4', () => {
    const md = `# Title\n\n## First\ntext\n\n### Nested\ntext\n\n## Second\n\n#### Too deep\n`
    expect(outlineOf(md).map((h) => [h.depth, h.text])).toEqual([
      [2, 'First'],
      [3, 'Nested'],
      [2, 'Second'],
    ])
  })

  it('does not mistake a comment inside fenced code for a heading', () => {
    const md = '## Real\n\n```bash\n## not a heading\n```\n\n## Also real\n'
    expect(outlineOf(md).map((h) => h.text)).toEqual(['Real', 'Also real'])
  })

  it('strips inline markdown out of heading text', () => {
    expect(outlineOf('## The *real* `secret`\n')[0].text).toBe('The real secret')
  })

  it('derives ids purely from text, so the renderer can match them', () => {
    // No dedup counter: the renderer derives ids independently during render,
    // and a stateful counter advanced on React's repeat calls, leaving every
    // contents link pointing at an id that no heading had.
    const ids = outlineOf('## Notes\n\n## Notes\n').map((h) => h.id)
    expect(ids).toEqual(['notes', 'notes'])
  })

  it('is idempotent — calling twice gives the same id', () => {
    expect(headingId('The Adobo')).toBe('the-adobo')
    expect(headingId('The Adobo')).toBe('the-adobo')
  })

  it('handles headings that are only punctuation', () => {
    expect(outlineOf('## ???\n')[0].id).toBe('section')
  })
})

describe('headingId', () => {
  it('makes a URL-safe slug and keeps accents readable', () => {
    expect(headingId('Why Birria, Really?')).toBe('why-birria-really')
    expect(headingId('Sobre el adobo')).toBe('sobre-el-adobo')
  })
})

describe('deservesContents', () => {
  const threeHeadings = outlineOf('## A\n\n## B\n\n## C\n')

  it('refuses a contents block for a short note, however sectioned', () => {
    // The failure mode worth avoiding: furniture taller than the prose.
    expect(deservesContents(`## A\n## B\n## C\n${words(200)}`, threeHeadings)).toBe(false)
  })

  it('uses a threshold the storyMarkdown field can actually reach', () => {
    // The field caps at 5,000 characters — roughly 850 words — so a threshold
    // near 800 would fire only for stories at the very maximum. This guards
    // against someone quietly raising it back out of reach.
    expect(CONTENTS_MIN_WORDS).toBeLessThanOrEqual(600)
  })

  it('refuses one for a long story with nothing to list', () => {
    expect(deservesContents(words(2000), [])).toBe(false)
    expect(deservesContents(words(2000), threeHeadings.slice(0, 2))).toBe(false)
  })

  it('grants one when the story is both long and sectioned', () => {
    expect(deservesContents(`## A\n## B\n## C\n${words(600)}`, threeHeadings)).toBe(true)
  })
})
