import { describe, expect, it } from 'vitest'

import { activeSection, recipeSections } from '@/lib/recipeContents'

const bare = { hasVideo: false, hasStory: false, hasRelated: false }

describe('recipeSections', () => {
  it('gives every recipe a contents list, however sparse the record', () => {
    // The point of this list, as opposed to the story outline: it does not
    // wait for a recipe to be long enough to deserve one.
    expect(recipeSections(bare).map((s) => s.id)).toEqual(['ingredients', 'method'])
  })

  it('lists only sections the page will actually render', () => {
    // A contents entry that scrolls to nothing is worse than no entry.
    expect(recipeSections({ ...bare, hasStory: true }).map((s) => s.id)).toEqual([
      'ingredients',
      'method',
      'notes',
    ])
    expect(recipeSections({ ...bare, hasVideo: true }).map((s) => s.id)).toEqual([
      'ingredients',
      'method',
      'watch',
    ])
  })

  it('keeps page order, so the list reads as the page scrolls', () => {
    expect(
      recipeSections({ hasVideo: true, hasStory: true, hasRelated: true }).map((s) => s.id),
    ).toEqual(['ingredients', 'method', 'watch', 'notes', 'more'])
  })

  it('labels sections for a cook, not for the schema', () => {
    expect(recipeSections({ ...bare, hasRelated: true }).map((s) => s.label)).toEqual([
      'Ingredients',
      'Method',
      'More like this',
    ])
  })
})

describe('activeSection', () => {
  // Distances from the top of the viewport, as getBoundingClientRect reports
  // them: negative once a section has scrolled above the fold.
  const LINE = 140

  it('marks nothing before the first section reaches the line', () => {
    // Scroll position zero on a recipe: the hero fills the screen and no
    // section has arrived yet. Marking one anyway would be a lie.
    expect(activeSection([{ id: 'ingredients', top: 900 }, { id: 'method', top: 2400 }], LINE)).toBe('')
  })

  it('keeps a long section marked while the next is still below', () => {
    expect(
      activeSection(
        [
          { id: 'ingredients', top: -1400 },
          { id: 'method', top: -60 },
          { id: 'notes', top: 2200 },
        ],
        LINE,
      ),
    ).toBe('method')
  })

  it('does not hand over the moment the next section peeks in', () => {
    // notes is on screen at 700px but has not reached the reading line, so
    // method — the section actually being read — keeps the mark.
    expect(
      activeSection([{ id: 'method', top: -800 }, { id: 'notes', top: 700 }], LINE),
    ).toBe('method')
  })

  it('hands over once the next section crosses the line', () => {
    expect(
      activeSection([{ id: 'method', top: -1600 }, { id: 'notes', top: 130 }], LINE),
    ).toBe('notes')
  })

  it('marks the last section at the bottom of the page', () => {
    expect(
      activeSection(
        [
          { id: 'method', top: -3000 },
          { id: 'notes', top: -1200 },
          { id: 'more', top: -300 },
        ],
        LINE,
      ),
    ).toBe('more')
  })

  it('copes with no sections at all', () => {
    expect(activeSection([], LINE)).toBe('')
  })
})
