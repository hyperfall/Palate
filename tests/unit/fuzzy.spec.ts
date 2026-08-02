import { describe, expect, it } from 'vitest'

import { allowedEdits, editDistance, foldText, fuzzyMatches } from '@/lib/fuzzy'

describe('foldText', () => {
  it('strips the accents a hurried person will not type', () => {
    // Without this, "saute" misses "Sauté" — which reads as the site not
    // having the recipe rather than as a spelling difference.
    expect(foldText('Sauté')).toBe('saute')
    expect(foldText('Jalapeño Purée')).toBe('jalapeno puree')
  })

  it('flattens punctuation so it cannot split a word', () => {
    expect(foldText('Cacio e Pepe — classic!')).toBe('cacio e pepe classic')
  })
})

describe('editDistance', () => {
  it('measures real edits', () => {
    expect(editDistance('shakshuka', 'shakshouka', 2)).toBe(1)
    expect(editDistance('chicken', 'chiken', 2)).toBe(1)
    expect(editDistance('abc', 'abc', 2)).toBe(0)
  })

  it('gives up rather than finishing a hopeless comparison', () => {
    // The early exit is what makes this safe to run over an index on every
    // keystroke; it must report "further than max", not the true distance.
    expect(editDistance('banana', 'chicken', 2)).toBeGreaterThan(2)
  })
})

describe('allowedEdits', () => {
  it('grants a short query no slack at all', () => {
    // At three characters one edit reaches so many unrelated words that results
    // stop looking like a search.
    expect(allowedEdits('tof')).toBe(0)
    expect(allowedEdits('abc')).toBe(0)
  })

  it('opens up as a typo becomes the likelier explanation', () => {
    expect(allowedEdits('chiken')).toBe(1)
    expect(allowedEdits('shakshouka')).toBe(2)
  })
})

describe('fuzzyMatches', () => {
  it('forgives the other correct spelling', () => {
    expect(fuzzyMatches('Weeknight Shakshuka', 'shakshouka')).toBe(true)
    expect(fuzzyMatches('Bibimbap with Gochujang Sauce', 'bibimbop')).toBe(true)
  })

  it('forgives a typo in one word of a multi-word query', () => {
    // Judged per word: as one 13-character string, "butter chiken" matches no
    // single word and would find nothing.
    expect(fuzzyMatches('Butter Chicken', 'butter chiken')).toBe(true)
    expect(fuzzyMatches('Butter Chicken', 'buter chicken')).toBe(true)
  })

  it('requires every query word to land somewhere', () => {
    expect(fuzzyMatches('Butter Chicken', 'butter kimchi')).toBe(false)
  })

  it('accepts a partly-typed word as a prefix, not a typo', () => {
    expect(fuzzyMatches('Weeknight Shakshuka', 'shakshou')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(fuzzyMatches('Butter Chicken', 'banana')).toBe(false)
    expect(fuzzyMatches('Mapo Tofu', 'xyzzy')).toBe(false)
    // Short query, no slack: must not become a wildcard.
    expect(fuzzyMatches('Mapo Tofu', 'tof')).toBe(false)
  })

  it('copes with empty input on either side', () => {
    expect(fuzzyMatches('', 'chicken')).toBe(false)
    expect(fuzzyMatches('Butter Chicken', '')).toBe(false)
    expect(fuzzyMatches('Butter Chicken', '   ')).toBe(false)
  })
})

describe('fuzzyMatches — catalog fallback shape', () => {
  // The catalog's second pass matches against "<title> <cuisine name>", so a
  // misspelling of either has to land. These pin the cases that were broken.
  const hay = (title: string, cuisine: string) => `${title} ${cuisine}`

  it('recovers a misspelled dish name', () => {
    expect(fuzzyMatches(hay('Weeknight Shakshuka', 'Levantine'), 'shakshouka')).toBe(true)
    expect(fuzzyMatches(hay('Bibimbap with Gochujang Sauce', 'Korean'), 'bibimbop')).toBe(true)
  })

  it('recovers a misspelled cuisine', () => {
    expect(fuzzyMatches(hay('Oyakodon', 'Japanese'), 'japanse')).toBe(true)
  })

  it('still refuses a query that is simply not there', () => {
    // The fallback must be able to return nothing, or the catalog would answer
    // every nonsense query with an arbitrary recipe.
    expect(fuzzyMatches(hay('Butter Chicken', 'Indian'), 'xyzzy')).toBe(false)
    expect(fuzzyMatches(hay('Mapo Tofu', 'Chinese'), 'lasagne')).toBe(false)
  })
})
