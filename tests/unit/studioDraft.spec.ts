import { beforeEach, describe, expect, it } from 'vitest'

import { clearDraft, draftAge, draftHasContent, loadDraft, saveDraft } from '@/lib/studioDraft'

const base = {
  title: '',
  videoUrl: '',
  story: '',
  storyMarkdown: '',
  storyImageIds: [] as number[],
  cuisine: '',
  course: 'dinner',
  mainIngredient: 'vegetables',
  difficulty: 'easy',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  diets: [] as string[],
  taste: { spiciness: 0, sweetness: 0, richness: 2, effort: 1 },
  ingredientRows: [{ quantity: '', unit: '', item: '' }],
  stepRows: [{ text: '', imageId: null, imageUrl: null }],
}

// This jsdom build ships no localStorage (and Node's global of the same name is
// unusable), so install a minimal in-memory one — the logic under test is ours,
// not the browser's implementation.
beforeEach(() => {
  const mem = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size
      },
    } as Storage,
  })
  clearDraft()
})

describe('studio draft', () => {
  it('does not save an untouched form — an empty draft is clutter, not work', () => {
    saveDraft(base)
    expect(loadDraft()).toBeNull()
  })

  it('round-trips a real draft', () => {
    saveDraft({ ...base, title: 'Birria Tacos', cuisine: '7' })
    const d = loadDraft()
    expect(d?.title).toBe('Birria Tacos')
    expect(d?.cuisine).toBe('7')
    expect(typeof d?.savedAt).toBe('number')
  })

  it('counts ingredient and step work as content on its own', () => {
    expect(
      draftHasContent({ ...base, savedAt: Date.now(), ingredientRows: [{ quantity: '2', unit: '', item: '' }] }),
    ).toBe(true)
    expect(
      draftHasContent({ ...base, savedAt: Date.now(), stepRows: [{ text: 'Brown the beef', imageId: null, imageUrl: null }] }),
    ).toBe(true)
    expect(draftHasContent({ ...base, savedAt: Date.now() })).toBe(false)
  })

  it('drops a draft older than the keep window', () => {
    saveDraft({ ...base, title: 'Ancient' })
    const raw = JSON.parse(window.localStorage.getItem('palate.studio.draft.v1')!)
    raw.savedAt = Date.now() - 15 * 24 * 60 * 60 * 1000
    window.localStorage.setItem('palate.studio.draft.v1', JSON.stringify(raw))
    expect(loadDraft()).toBeNull()
  })

  it('survives corrupt storage rather than breaking the form', () => {
    window.localStorage.setItem('palate.studio.draft.v1', '{ not json')
    expect(loadDraft()).toBeNull()
  })

  it('clears on demand', () => {
    saveDraft({ ...base, title: 'Gone soon' })
    clearDraft()
    expect(loadDraft()).toBeNull()
  })

  it('describes its age in plain words', () => {
    const now = Date.now()
    expect(draftAge(now - 30_000, now)).toBe('just now')
    expect(draftAge(now - 20 * 60_000, now)).toBe('20 minutes ago')
    expect(draftAge(now - 3 * 3600_000, now)).toBe('3 hours ago')
    expect(draftAge(now - 26 * 3600_000, now)).toBe('yesterday')
    expect(draftAge(now - 5 * 24 * 3600_000, now)).toBe('5 days ago')
  })
})
