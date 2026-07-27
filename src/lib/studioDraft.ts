import type { IngredientRow } from '@/components/IngredientRowsInput'
import type { StepRow } from '@/components/StepRowsInput'

/**
 * Local draft of an in-progress studio submission.
 *
 * The unsaved-work guard stops an accidental navigation; this survives the
 * things a guard can't — a crash, a closed laptop, a decision to finish the
 * recipe tomorrow. Stored per-browser, never sent anywhere.
 *
 * The hero photo is deliberately absent: it's a File/blob that can't be
 * serialized, and re-picking it is quick. Step and story images DO persist,
 * because they're already uploaded and only their ids travel.
 */
const KEY = 'palate.studio.draft.v1'

/** Always via window: Node exposes its own (unusable) localStorage global that
 *  would otherwise shadow the browser's. */
const store = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // storage disabled (private mode, blocked cookies)
  }
}
/** Older than this and it isn't a draft any more, it's clutter. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export type StudioDraft = {
  savedAt: number
  title: string
  videoUrl: string
  story: string
  storyMarkdown: string
  storyImageIds: number[]
  cuisine: string
  course: string
  mainIngredient: string
  difficulty: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  diets: string[]
  taste: Record<string, number>
  ingredientRows: IngredientRow[]
  stepRows: StepRow[]
}

/** True when the draft holds anything worth restoring. */
export function draftHasContent(d: StudioDraft): boolean {
  return Boolean(
    d.title.trim() ||
      d.story.trim() ||
      d.storyMarkdown.trim() ||
      d.videoUrl.trim() ||
      d.cuisine ||
      d.diets.length ||
      d.storyImageIds.length ||
      d.ingredientRows.some((r) => r.item?.trim() || r.quantity?.trim() || r.unit?.trim()) ||
      d.stepRows.some((r) => r.text?.trim() || r.imageId),
  )
}

export function saveDraft(draft: Omit<StudioDraft, 'savedAt'>): void {
  try {
    const full: StudioDraft = { ...draft, savedAt: Date.now() }
    if (!draftHasContent(full)) {
      clearDraft()
      return
    }
    store()?.setItem(KEY, JSON.stringify(full))
  } catch {
    // Private mode or a full quota — a missing draft must never break the form.
  }
}

export function loadDraft(): StudioDraft | null {
  try {
    const raw = store()?.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as StudioDraft
    if (!d || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS) {
      clearDraft()
      return null
    }
    if (!Array.isArray(d.ingredientRows) || !Array.isArray(d.stepRows)) return null
    return draftHasContent(d) ? d : null
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    store()?.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}

/** "just now" / "20 minutes ago" / "yesterday" — plain, no library. */
export function draftAge(savedAt: number, now = Date.now()): string {
  const mins = Math.round((now - savedAt) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
