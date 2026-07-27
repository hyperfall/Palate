'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ImagePicker } from '@/components/ImagePicker'
import { IngredientRowsInput, emptyIngredientRow, type IngredientRow } from '@/components/IngredientRowsInput'
import { StepRowsInput, emptyStepRow, type StepRow } from '@/components/StepRowsInput'
import { foldIngredientRows } from '@/lib/ingredients/rows'
import { StoryEditor } from '@/components/StoryEditor'
import { Select, Stepper } from '@/components/controls'
import { AXIS_COLOR } from '@/components/TasteGauge'
import { VideoEmbed } from '@/components/VideoEmbed'
import { MIN_INGREDIENTS, MIN_STEPS, validateRecipeNumbers } from '@/lib/recipeLimits'
import { clearDraft, draftAge, loadDraft, saveDraft, type StudioDraft } from '@/lib/studioDraft'
import { Disclosure } from '@/components/Disclosure'
import { QuickPaste } from '@/components/QuickPaste'
import type { ParsedRecipe } from '@/lib/recipeParse'
import { supabaseBrowser } from '@/lib/supabase/client'
import {
  COURSES,
  DIETARY_TAGS,
  DIFFICULTIES,
  MAIN_INGREDIENTS,
  TASTE_AXES,
  TASTE_AXIS_LABELS,
  type TasteAxis,
} from '@/lib/taxonomy'

/**
 * The upload form, kept humane: ingredients and steps are one-per-line
 * textareas (creators paste from their notes), everything else is a select.
 * Gate: signed-in creators only — with a one-click upgrade for existing
 * accounts, because friction is the enemy of a self-sustaining engine.
 */

const inputCls =
  'w-full rounded border border-rule bg-transparent px-3 py-2 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none'
// grid-cols-1 (minmax(0,1fr)) rather than a bare `grid` (implicit auto column):
// an auto column sizes to its content's max-content and overflows a narrow phone
// column; minmax(0,1fr) makes every stacked field fill — and never exceed — its
// container.
const labelCls = 'grid grid-cols-1 gap-1.5'

// Field defaults, named once so a post-submit reset restores exactly the initial
// state — no stale cuisine/diet/taste/story carrying into the next recipe.
const INITIAL_TASTE: Record<TasteAxis, number> = { spiciness: 0, sweetness: 0, richness: 2, effort: 1 }

export function StudioForm({
  cuisines,
}: {
  cuisines: Array<{ id: number; name: string; flagEmoji?: string | null }>
}) {
  const supabase = supabaseBrowser()
  const [gate, setGate] = useState<'checking' | 'anonymous' | 'cook' | 'creator'>('checking')
  const [profile, setProfile] = useState<{
    name: string | null
    username: string | null
    avatarUrl: string | null
    verified: boolean
  }>({ name: null, username: null, avatarUrl: null, verified: false })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [pickerKey, setPickerKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  // Any real edit marks the form dirty. React change events bubble, so one
  // handler on <form> covers every input, textarea, select and file picker
  // inside it — and programmatic prefill (editing an existing recipe) doesn't
  // fire one, so opening an edit and leaving straight away won't nag.
  const [touched, setTouched] = useState(false)
  // A draft found on arrival is OFFERED, never silently applied — restoring
  // over a form someone has started typing in would be its own kind of loss.
  // Quick mode: paste-to-parse. Off by default — the editor is the home
  // surface; this is the shortcut for creators who already wrote it down.
  const [quick, setQuick] = useState(false)
  const [foundDraft, setFoundDraft] = useState<StudioDraft | null>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  // Below xl the preview isn't pinned beside the form; a floating button opens it
  // as a dismissible overlay so it never crowds the editing space.
  const [previewOpen, setPreviewOpen] = useState(false)

  const [title, setTitle] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  // Debounced copy that drives the preview embed, so the iframe doesn't remount
  // on every keystroke while the creator is still typing the URL.
  const [videoPreview, setVideoPreview] = useState('')
  const [story, setStory] = useState('')
  const [storyMarkdown, setStoryMarkdown] = useState('')
  const [storyImageIds, setStoryImageIds] = useState<number[]>([])
  const [editRecipeId, setEditRecipeId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState<string | null>(null)
  const [keepHeroImageId, setKeepHeroImageId] = useState<number | null>(null)
  const [cuisine, setCuisine] = useState('')
  const [course, setCourse] = useState('dinner')
  const [mainIngredient, setMainIngredient] = useState('vegetables')
  const [difficulty, setDifficulty] = useState('easy')
  const [servings, setServings] = useState(2)
  const [prepMinutes, setPrepMinutes] = useState(10)
  const [cookMinutes, setCookMinutes] = useState(20)
  const [diets, setDiets] = useState<string[]>([])
  const [taste, setTaste] = useState<Record<TasteAxis, number>>({ ...INITIAL_TASTE })
  const [creatorBusy, setCreatorBusy] = useState(false)
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    { ...emptyIngredientRow },
    { ...emptyIngredientRow },
    { ...emptyIngredientRow },
  ])
  const [stepRows, setStepRows] = useState<StepRow[]>([
    { ...emptyStepRow },
    { ...emptyStepRow },
    { ...emptyStepRow },
  ])

  // Edit mode: ?edit=<recipeId> pre-fills the form with the creator's own recipe.
  // Resubmitting sends it back through review before it replaces the live version.
  useEffect(() => {
    const editId = Number(new URLSearchParams(window.location.search).get('edit'))
    if (!Number.isInteger(editId) || editId <= 0) return
    let active = true
    void fetch(`/studio/recipe?id=${editId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return
        setEditRecipeId(d.id)
        setEditTitle(d.title)
        setKeepHeroImageId(d.heroImageId ?? null)
        if (d.heroImageUrl) setPhotoUrl(d.heroImageUrl)
        setTitle(d.title ?? '')
        setStory(d.story ?? '')
        setStoryMarkdown(d.storyMarkdown ?? '')
        setStoryImageIds(Array.isArray(d.storyImageIds) ? d.storyImageIds : [])
        setCuisine(d.cuisine ? String(d.cuisine) : '')
        setCourse(d.course ?? 'dinner')
        setMainIngredient(d.mainIngredient ?? 'vegetables')
        setDifficulty(d.difficulty ?? 'easy')
        setServings(d.servings ?? 2)
        setPrepMinutes(d.prepMinutes ?? 10)
        setCookMinutes(d.cookMinutes ?? 20)
        setTaste({ spiciness: d.spiciness ?? 0, sweetness: d.sweetness ?? 0, richness: d.richness ?? 0, effort: d.effort ?? 0 })
        setDiets(Array.isArray(d.dietaryTags) ? d.dietaryTags : [])
        setVideoUrl(d.videoUrl ?? '')
        setIngredientRows(d.ingredients?.length ? d.ingredients : [{ ...emptyIngredientRow }, { ...emptyIngredientRow }])
        setStepRows(
          d.steps?.length
            ? d.steps.map((st: string | { text?: string; imageId?: number | null; imageUrl?: string | null }) =>
                typeof st === 'string'
                  ? { text: st, imageId: null, imageUrl: null }
                  : { text: st.text ?? '', imageId: st.imageId ?? null, imageUrl: st.imageUrl ?? null },
              )
            : [{ ...emptyStepRow }, { ...emptyStepRow }, { ...emptyStepRow }],
        )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setGate('anonymous')
      return
    }
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!data.user) setGate('anonymous')
        else {
          const m = data.user.user_metadata ?? {}
          setProfile({
            name: (m.display_name as string) ?? null,
            username: (m.username as string) ?? null,
            avatarUrl: (m.avatar_url as string) ?? null,
            verified: m.verified === true,
          })
          setGate(m.account_type === 'creator' ? 'creator' : 'cook')
        }
      })
      .catch(() => setGate('anonymous'))
  }, [supabase])

  useEffect(() => {
    const t = setTimeout(() => setVideoPreview(videoUrl.trim()), 500)
    return () => clearTimeout(t)
  }, [videoUrl])

  useEffect(() => {
    if (!previewOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [previewOpen])

  // NOTE: everything above the gate's early returns — hooks must run on every
  // render, and the gate below returns before the form exists.
  // Offer any saved draft once, on arrival — but never over an edit-in-progress,
  // where the form is already prefilled with the live recipe.
  useEffect(() => {
    if (editRecipeId) return
    const d = loadDraft()
    if (d) setFoundDraft(d)
  }, [editRecipeId])

  // Autosave, debounced. Editing an existing recipe is excluded: its draft would
  // collide with the new-recipe draft and neither would be trustworthy.
  useEffect(() => {
    if (editRecipeId || !touched) return
    const t = setTimeout(() => {
      saveDraft({
        title,
        videoUrl,
        story,
        storyMarkdown,
        storyImageIds,
        cuisine,
        course,
        mainIngredient,
        difficulty,
        servings,
        prepMinutes,
        cookMinutes,
        diets,
        taste,
        ingredientRows,
        stepRows,
      })
      setDraftSavedAt(Date.now())
    }, 800)
    return () => clearTimeout(t)
  }, [
    editRecipeId,
    touched,
    title,
    videoUrl,
    story,
    storyMarkdown,
    storyImageIds,
    cuisine,
    course,
    mainIngredient,
    difficulty,
    servings,
    prepMinutes,
    cookMinutes,
    diets,
    taste,
    ingredientRows,
    stepRows,
  ])

  /** Paste results land in the editor — filling only what the paste supplied,
   *  never clearing a field the creator has already set. */
  const applyParsed = (p: ParsedRecipe) => {
    if (p.title && !title.trim()) setTitle(p.title)
    if (p.servings) setServings(p.servings)
    if (p.prepMinutes) setPrepMinutes(p.prepMinutes)
    if (p.cookMinutes) setCookMinutes(p.cookMinutes)
    if (p.ingredientRows.length) {
      setIngredientRows(
        p.ingredientRows.map((r) => ({ quantity: r.quantity, unit: r.unit, item: r.item })),
      )
    }
    if (p.stepRows.length) {
      setStepRows(p.stepRows.map((text) => ({ text, imageId: null, imageUrl: null })))
    }
    setQuick(false)
    setTouched(true)
    setNotice({
      kind: 'ok',
      text: 'Filled from your paste — check the rows, then add a photo and a cuisine.',
    })
  }

  const restoreDraft = (d: StudioDraft) => {
    setTitle(d.title)
    setVideoUrl(d.videoUrl)
    setStory(d.story)
    setStoryMarkdown(d.storyMarkdown)
    setStoryImageIds(d.storyImageIds ?? [])
    setCuisine(d.cuisine)
    setCourse(d.course)
    setMainIngredient(d.mainIngredient)
    setDifficulty(d.difficulty)
    setServings(d.servings)
    setPrepMinutes(d.prepMinutes)
    setCookMinutes(d.cookMinutes)
    setDiets(d.diets ?? [])
    setTaste({ ...INITIAL_TASTE, ...(d.taste as Record<TasteAxis, number>) })
    if (d.ingredientRows?.length) setIngredientRows(d.ingredientRows)
    if (d.stepRows?.length) setStepRows(d.stepRows)
    setDraftSavedAt(d.savedAt)
    setFoundDraft(null)
    setTouched(true)
  }

  // A studio recipe is 20 minutes of work: photo, ingredients, steps, uploads.
  // Losing it to a stray refresh or back-button is unacceptable, so warn while
  // there's unsaved work (browsers show their own wording).
  useEffect(() => {
    if (!touched) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [touched])

  if (gate === 'checking') return null

  if (gate === 'anonymous') {
    return (
      <div className="ticket-card max-w-[34rem] p-6">
        <p className="eyebrow m-0 text-flame">Creator studio</p>
        <p className="mt-1 font-display text-[1.5rem] leading-tight text-ink">Sign in to publish</p>
        <p className="mt-2 text-slate">
          Create an account (pick “I’m a creator” at sign-up) and come straight back here.
        </p>
        <Link href="/account" className="btn-primary mt-5">
          Sign in →
        </Link>
      </div>
    )
  }

  if (gate === 'cook') {
    return (
      <div className="ticket-card max-w-[34rem] p-6">
        <p className="eyebrow m-0 text-flame">Signed in as a cook</p>
        <p className="mt-1 font-display text-[1.5rem] leading-tight text-ink">Switch on creator mode</p>
        <p className="mt-2 text-slate">
          Switch this account to a creator account to publish recipes — everything you’ve saved
          stays exactly as it is.
        </p>
        <button
          type="button"
          disabled={creatorBusy}
          className="btn-primary mt-5 disabled:opacity-60"
          onClick={async () => {
            if (!supabase || creatorBusy) return
            setNotice(null)
            setCreatorBusy(true)
            const { error } = await supabase.auth.updateUser({
              data: { account_type: 'creator' },
            })
            setCreatorBusy(false)
            if (error) {
              setNotice({ kind: 'error', text: 'Could not switch your account — try again in a moment.' })
              return
            }
            setGate('creator')
          }}
        >
          {creatorBusy ? 'Switching…' : 'Become a creator'}
        </button>
        {notice?.kind === 'error' && (
          <p role="alert" className="mt-3 m-0 text-[0.9375rem] text-heat">
            {notice.text}
          </p>
        )}
      </div>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)

    // Fold stray qualifier lines ("cut in half") into the ingredient above and
    // flag section labels, so neither becomes a phantom ingredient downstream.
    const ingredients = foldIngredientRows(
      ingredientRows
        .map((r) => ({
          quantity: r.quantity.trim(),
          unit: r.unit.trim(),
          item: r.item.trim(),
        }))
        .filter((r) => r.item),
    ).map((r) => ({
      item: r.item,
      ...(r.quantity ? { quantity: r.quantity } : {}),
      ...(r.unit ? { unit: r.unit } : {}),
      ...(r.heading ? { heading: true } : {}),
    }))
    const steps = stepRows
      .map((r) => ({ ...r, text: r.text.trim() }))
      .filter((r) => r.text)
      .map((r) => ({ text: r.text, ...(r.imageId ? { image: r.imageId } : {}) }))

    const missing = [
      !title.trim() && 'a title',
      !cuisine && 'a cuisine',
      ingredients.length < MIN_INGREDIENTS && `at least ${MIN_INGREDIENTS} ingredients`,
      steps.length < MIN_STEPS && `at least ${MIN_STEPS} steps`,
    ].filter(Boolean)
    if (missing.length > 0) {
      setNotice({ kind: 'error', text: `Still needs ${missing.join(', ')}.` })
      return
    }

    // Steppers already clamp, but ingredient quantities are freeform — catch any
    // out-of-range number here so the creator gets a friendly message, not a 400.
    const rangeError = validateRecipeNumbers({
      servings,
      prepMinutes,
      cookMinutes,
      ...taste,
      ingredients,
    })
    if (rangeError) {
      setNotice({ kind: 'error', text: rangeError })
      return
    }

    setBusy(true)
    try {
      const form = new FormData()
      if (photo) form.set('photo', photo)
      form.set(
        'recipe',
        JSON.stringify({
          title,
          cuisine: Number(cuisine),
          course,
          mainIngredient,
          difficulty,
          servings,
          prepMinutes,
          cookMinutes,
          dietaryTags: diets,
          videoUrl: videoUrl.trim() || undefined,
          story: story.trim() || undefined,
          storyMarkdown: storyMarkdown.trim() || undefined,
          storyImageIds: storyImageIds.length ? storyImageIds : undefined,
          ...(editRecipeId ? { editsRecipe: editRecipeId } : {}),
          ...(!photo && keepHeroImageId ? { keepHeroImageId } : {}),
          ...taste,
          ingredients,
          steps,
        }),
      )
      const res = await fetch('/studio/submit', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submission failed.')
      if (editRecipeId) {
        // Edited recipe: it stays live as-is until the edit is approved.
        setNotice({
          kind: 'ok',
          text: 'Changes submitted — a human reviews them, then they replace the live recipe. It stays published meanwhile.',
        })
        return
      }
      setNotice({
        kind: 'ok',
        text: 'Submitted — a human reviews it next, then it goes live under your name.',
      })
      // Full reset — every field back to its initial state, so nothing (cuisine,
      // diet, taste, story…) silently rides into the creator's next recipe.
      setTitle('')
      setPhoto(null)
      // Revoke before dropping the reference — the cropped blob would otherwise
      // be held for the life of the tab (the picker's own clear does revoke).
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setPickerKey((k) => k + 1)
      setIngredientRows([{ ...emptyIngredientRow }, { ...emptyIngredientRow }, { ...emptyIngredientRow }])
      setStepRows([{ ...emptyStepRow }, { ...emptyStepRow }, { ...emptyStepRow }])
      setVideoUrl('')
      setVideoPreview('')
      setStory('')
      setStoryMarkdown('')
      setStoryImageIds([])
      setCuisine('')
      setCourse('dinner')
      setMainIngredient('vegetables')
      setDifficulty('easy')
      setServings(2)
      setPrepMinutes(10)
      setCookMinutes(20)
      setDiets([])
      setTaste({ ...INITIAL_TASTE })
      setTouched(false)
      clearDraft()
      setDraftSavedAt(null)
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Submission failed — try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const previewFacts = [
    cuisines.find((c) => String(c.id) === cuisine)?.name,
    course,
    `${prepMinutes + cookMinutes} min`,
    `Serves ${servings}`,
  ].filter(Boolean)
  // Run the same fold the save does, so the preview shows the list that will
  // actually ship — headings as headings, qualifiers folded into the line above.
  const previewIngredients = foldIngredientRows(
    ingredientRows
      .map((r) => ({ quantity: r.quantity.trim(), unit: r.unit.trim(), item: r.item.trim() }))
      .filter((r) => r.item),
  ).map((r) => ({
    item: r.item,
    measure: [r.quantity?.trim(), r.unit?.trim()].filter(Boolean).join(' '),
    heading: Boolean(r.heading),
  }))
  const previewSteps = stepRows.filter((r) => r.text.trim())

  return (
    <>
    {editRecipeId ? (
      <div className="mb-8 rounded-lg border border-flame/40 bg-flame/5 px-4 py-3">
        <p className="m-0 text-[0.9375rem] text-ink">
          Editing <span className="font-semibold">{editTitle ?? 'your recipe'}</span>. Changes go back for review — the live
          recipe stays as it is until they’re approved.
        </p>
      </div>
    ) : (
      <p className="mb-8 text-[0.9375rem] text-slate">
        Tracking what you’ve already sent?{' '}
        <Link href="/dashboard" className="text-flame underline underline-offset-4">
          See your recipes on the dashboard
        </Link>
        .
      </p>
    )}
    {quick && (
      <div className="mb-8">
        <QuickPaste onApply={applyParsed} onCancel={() => setQuick(false)} />
      </div>
    )}
    {foundDraft && (
      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-flame/40 bg-flame/5 px-4 py-3">
        <p className="m-0 text-[0.9375rem] text-ink">
          You have an unfinished recipe from {draftAge(foundDraft.savedAt)}
          {foundDraft.title.trim() ? ` — “${foundDraft.title.trim()}”` : ''}.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => restoreDraft(foundDraft)} className="chip">
            Pick up where you left off
          </button>
          <button
            type="button"
            onClick={() => {
              clearDraft()
              setFoundDraft(null)
            }}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.6875rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-heat hover:underline"
          >
            Discard
          </button>
        </div>
      </div>
    )}
    {/* One column, sharing the page's left edge — the header, step strip and
        footer all start there, so a centred column would align with nothing.
        The preview is a deliberate look instead of pinned furniture. */}
    <div className="grid max-w-[52rem] gap-10">
    <form
      onSubmit={submit}
      onChange={() => {
        setTouched(true)
        // A lingering "Submitted" while they type the next recipe is a lie.
        setNotice((n) => (n?.kind === 'ok' ? null : n))
      }}
      className="grid min-w-0 grid-cols-1 gap-6"
    >
      {/* Document-style opening: the title is typed as a title, not as a form
          field — the page reads as the recipe forming, and the shortcut to
          quick mode sits where someone would look before starting to type. */}
      <div className="grid gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="eyebrow">Recipe title</span>
          {!quick && (
            <button
              type="button"
              onClick={() => setQuick(true)}
              className="font-mono text-[0.6875rem] tracking-[0.1em] text-flame uppercase underline-offset-4 hover:underline"
            >
              Already written it? Paste it in →
            </button>
          )}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Birria Tacos"
          aria-label="Recipe title"
          className="w-full border-0 border-b-2 border-rule bg-transparent px-0 pb-2 font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-tight text-ink placeholder:text-slate/40 focus:border-flame focus:outline-none"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className={labelCls}>
          <span className="eyebrow">Your photo of the dish</span>
          <ImagePicker
            key={pickerKey}
            compact
            aspect={4 / 3}
            minResolution={1200}
            onCropped={(file, url) => {
              setPhoto(file)
              setPhotoUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return url
              })
            }}
            onClear={() => {
              setPhoto(null)
              setPhotoUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
              })
            }}
          />
        </div>
        <label className={labelCls}>
          <span className="eyebrow">Video link (optional)</span>
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="TikTok / YouTube / Reels"
            className={inputCls}
          />
        </label>
      </div>


      {/* The recipe itself leads — what a cook came here to write. The
          classification below it, and the optional depth folded under that. */}
      <div className={labelCls}>
        <span className="eyebrow">Ingredients</span>
        <span className="-mt-0.5 text-[0.8125rem] leading-snug text-slate">
          Quantity, unit, then name — paste a whole list to fill rows fast. At least{' '}
          {MIN_INGREDIENTS}.
        </span>
        <IngredientRowsInput value={ingredientRows} onChange={setIngredientRows} />
      </div>

      <div className={labelCls}>
        <span className="eyebrow">Steps — one per row</span>
        <span className="-mt-0.5 text-[0.8125rem] leading-snug text-slate">
          One action per step, in order. At least {MIN_STEPS}.
        </span>
        <StepRowsInput value={stepRows} onChange={setStepRows} />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <label className={labelCls}>
          <span className="eyebrow">Cuisine</span>
          <Select value={cuisine} onChange={setCuisine} ariaLabel="Cuisine">
            <option value="">Choose…</option>
            {cuisines.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flagEmoji ? `${c.flagEmoji}  ${c.name}` : c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className={labelCls}>
          <span className="eyebrow">Meal</span>
          <Select value={course} onChange={setCourse} ariaLabel="Meal">
            {COURSES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </label>
        <label className={labelCls}>
          <span className="eyebrow">Built on</span>
          <Select value={mainIngredient} onChange={setMainIngredient} ariaLabel="Main ingredient">
            {MAIN_INGREDIENTS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-6 sm:grid-cols-4">
        <div className={labelCls}>
          <span className="eyebrow">Serves</span>
          <Stepper value={servings} onChange={setServings} min={1} max={24} ariaLabel="Servings" />
        </div>
        <div className={labelCls}>
          <span className="eyebrow">Prep</span>
          <Stepper value={prepMinutes} onChange={setPrepMinutes} min={0} max={1440} step={5} duration ariaLabel="Prep time in minutes" />
        </div>
        <div className={labelCls}>
          <span className="eyebrow">Cook</span>
          <Stepper value={cookMinutes} onChange={setCookMinutes} min={0} max={1440} step={5} duration ariaLabel="Cook time in minutes" />
        </div>
        <label className={labelCls}>
          <span className="eyebrow">Difficulty</span>
          <Select value={difficulty} onChange={setDifficulty} ariaLabel="Difficulty">
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </Select>
        </label>
      </div>

      <fieldset className="grid gap-5 border-t border-rule pt-5 sm:grid-cols-2">
        <legend className="eyebrow">How it tastes — your honest call</legend>
        {TASTE_AXES.map((axis) => (
          <div key={axis} style={{ ['--gauge-hue' as string]: AXIS_COLOR[axis] }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow">{TASTE_AXIS_LABELS[axis].title}</span>
              <span className="font-mono text-[0.8125rem] font-medium text-ink">
                {TASTE_AXIS_LABELS[axis].scale[taste[axis]]}
              </span>
            </div>
            <div className="mt-1.5 flex items-end gap-[3px]">
              {[0, 1, 2, 3, 4, 5].map((level) => {
                const active = taste[axis] >= level
                return (
                  <button
                    key={level}
                    type="button"
                    className="axis-btn"
                    aria-pressed={taste[axis] === level}
                    aria-label={`${TASTE_AXIS_LABELS[axis].title}: ${TASTE_AXIS_LABELS[axis].scale[level]}`}
                    onClick={() => setTaste((t) => ({ ...t, [axis]: level }))}
                  >
                    <span
                      className="axis-tick"
                      style={{
                        height: `${0.5 + level * 0.2}rem`,
                        ['--tick-strength' as string]: active ? '100%' : '26%',
                      }}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2 border-t border-rule pt-5">
        <span className="eyebrow w-full">Dietary (tick all that apply)</span>
        {DIETARY_TAGS.map((tag) => (
          <button
            key={tag.value}
            type="button"
            className="chip"
            aria-pressed={diets.includes(tag.value)}
            onClick={() =>
              setDiets((d) =>
                d.includes(tag.value) ? d.filter((v) => v !== tag.value) : [...d, tag.value],
              )
            }
          >
            {tag.label}
          </button>
        ))}
      </div>


      {/* Optional depth: nothing here is required to publish, so it stays
          folded until a creator wants it. */}
      <div className="border-t border-rule pt-2">
        <Disclosure
          title={<span className="eyebrow m-0">Story &amp; notes — optional</span>}
          meta={storyMarkdown.trim() || story.trim() ? 'written' : 'add depth'}
        >
          <div className="grid gap-6 pt-2">
      <label className={labelCls}>
        <span className="eyebrow">Notes (optional)</span>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={3}
          placeholder="A short note — a tip, the origin, why you cook it this way. Renders below the recipe, never before it."
          className={`${inputCls} resize-y`}
        />
      </label>

      <StoryEditor
        value={storyMarkdown}
        onChange={setStoryMarkdown}
        imageIds={storyImageIds}
        onImageIdsChange={setStoryImageIds}
      />
          </div>
        </Disclosure>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`m-0 text-[0.9375rem] ${notice.kind === 'error' ? 'text-heat' : 'text-richness'}`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? 'Sending…' : editRecipeId ? 'Submit changes for review' : 'Submit for review'}
        </button>
        {!editRecipeId && draftSavedAt && (
          <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">
            Draft saved in this browser
          </span>
        )}
      </div>
    </form>

    {/* Live preview — the published card in a modal, not a viewport takeover.
        The card previews at card width; a full-screen sheet just meant a wall
        of empty hero. Backdrop click and Escape both close. */}
    <aside
      aria-label="Recipe preview"
      role={previewOpen ? 'dialog' : undefined}
      aria-modal={previewOpen ? true : undefined}
      className={previewOpen ? 'fixed inset-0 z-50 grid place-items-center p-4 sm:p-8' : 'hidden'}
    >
      <button
        type="button"
        aria-label="Close preview"
        onClick={() => setPreviewOpen(false)}
        className="absolute inset-0 cursor-default border-none bg-ink/45 backdrop-blur-[2px]"
      />
      <div className="relative max-h-full w-full max-w-[26rem] overflow-y-auto rounded-lg bg-paper p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow m-0">Live preview — how it will look</p>
        <button
          type="button"
          onClick={() => setPreviewOpen(false)}
          aria-label="Close preview"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-ink hover:border-heat hover:text-heat"
        >
          ✕
        </button>
      </div>
      <div className="ticket-card is-static mt-3 overflow-hidden">
        <div className="relative bg-pan text-milk">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={photoUrl} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center bg-pan-deep">
              <span className="rounded-sm border border-dashed border-milk/25 px-4 py-2 font-mono text-[0.75rem] tracking-[0.06em] text-milk/50 uppercase">
                your photo lands here
              </span>
            </div>
          )}
          {/* Mirrors the published hero: photo at full colour, a wash only across
              the lower third, flame rule, oversized serif title, spec line under. */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-pan-deep/90 via-pan-deep/25 to-transparent p-5">
            <span className="mb-2 block h-[2px] w-8 bg-flame" aria-hidden="true" />
            <h3 className="font-display text-[2rem] leading-[0.95] tracking-[-0.01em] text-milk">
              {title || 'Your recipe title'}
            </h3>
            <p className="mt-2 m-0 font-mono text-[0.75rem] tracking-[0.02em] text-milk">
              {previewFacts.join(' · ')}
            </p>
          </div>
        </div>

        {/* Byline — matches the published recipe page exactly (plain "Written by",
            no avatar), so the preview never promises a treatment that won't ship. */}
        <div className="border-b border-rule p-4">
          <p className="m-0 flex flex-wrap items-center gap-1.5 text-[0.9375rem] leading-snug text-slate">
            Written by <span className="font-semibold text-ink">{profile.name ?? 'Your name'}</span>
            {profile.verified && (
              <span title="Verified creator" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-flame text-[0.625rem] text-paper">✓</span>
            )}
            {profile.username && (
              <span className="font-mono text-[0.75rem] text-slate">@{profile.username}</span>
            )}
          </p>
        </div>

        <div className="grid gap-5 p-4">
          <div>
            <p className="eyebrow m-0">Ingredients</p>
            <ul className="m-0 mt-2 list-none space-y-2 p-0">
              {(previewIngredients.length
                ? previewIngredients
                : [{ item: 'something delicious', measure: '2 tbsp', heading: false }]
              )
                .slice(0, 8)
                .map((row, i) =>
                  row.heading ? (
                    <li key={i} className="eyebrow pt-2 text-ink first:pt-0">
                      {row.item}
                    </li>
                  ) : (
                    <li key={i} className="leader text-[0.9375rem] leading-snug">
                      <span className="break-words [overflow-wrap:anywhere]">{row.item}</span>
                      {/* The dotted leader promises a measure — only draw it when
                          one is coming, exactly as the recipe page does. */}
                      {row.measure ? (
                        <>
                          <span className="leader__dots" aria-hidden="true" />
                          <span className="datum shrink-0">{row.measure}</span>
                        </>
                      ) : null}
                    </li>
                  ),
                )}
              {previewIngredients.length > 8 && (
                <li className="pt-1 font-mono text-[0.75rem] text-slate">+ {previewIngredients.length - 8} more</li>
              )}
            </ul>
          </div>
          <div>
            <p className="eyebrow m-0">Method</p>
            <ol className="m-0 mt-2 list-none space-y-3 p-0">
              {(previewSteps.length
                ? previewSteps
                : [{ text: 'Steps appear here as you write them.', imageUrl: null }]
              )
                .slice(0, 4)
                .map((step, i) => (
                  <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 gap-y-2">
                    <span className="font-mono text-[0.9375rem] font-bold text-flame tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="m-0 text-[0.9375rem] leading-relaxed break-words [overflow-wrap:anywhere]">
                      {step.text.trim()}
                    </p>
                    {step.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- local preview
                      <img
                        src={step.imageUrl}
                        alt=""
                        className="col-start-2 w-full rounded border border-rule object-cover"
                      />
                    )}
                  </li>
                ))}
              {previewSteps.length > 4 && (
                <li className="font-mono text-[0.75rem] text-slate">+ {previewSteps.length - 4} more steps</li>
              )}
            </ol>
          </div>

          {/* The creator's video, embedded exactly as viewers will see it —
              a recognised link becomes a player, anything else a Watch link. */}
          {videoPreview && (
            <div>
              <p className="eyebrow m-0">Watch</p>
              <div className="mt-2">
                <VideoEmbed url={videoPreview} title="Recipe video preview" />
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </aside>

      {/* Small screens only: a floating trigger opens the preview overlay, so it
          stays out of the way until the creator wants to check their work. */}
      {!previewOpen && (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          aria-haspopup="dialog"
          // Clear the fixed bottom nav on phones (it's ~3.25rem tall, sm:hidden);
          // on tablets there's no bottom bar, so sit closer to the edge.
          className="fixed right-5 bottom-[calc(3.25rem+env(safe-area-inset-bottom)+1rem)] z-40 flex items-center gap-2 rounded-full border border-flame bg-flame px-4 py-2.5 font-mono text-[0.75rem] font-semibold tracking-[0.12em] text-paper uppercase shadow-lg sm:bottom-6"
        >
          <span aria-hidden="true">◉</span> Live preview
        </button>
      )}
    </div>
    </>
  )
}
