'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ImagePicker } from '@/components/ImagePicker'
import { LineListInput } from '@/components/LineListInput'
import { Select, Stepper } from '@/components/controls'
import { AXIS_COLOR } from '@/components/TasteGauge'
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
const labelCls = 'grid gap-1.5'

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

  const [title, setTitle] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [course, setCourse] = useState('dinner')
  const [mainIngredient, setMainIngredient] = useState('vegetables')
  const [difficulty, setDifficulty] = useState('easy')
  const [servings, setServings] = useState(2)
  const [prepMinutes, setPrepMinutes] = useState(10)
  const [cookMinutes, setCookMinutes] = useState(20)
  const [diets, setDiets] = useState<string[]>([])
  const [taste, setTaste] = useState<Record<TasteAxis, number>>({
    spiciness: 0,
    sweetness: 0,
    richness: 2,
    effort: 1,
  })
  const [ingredientRows, setIngredientRows] = useState<string[]>(['', '', ''])
  const [stepRows, setStepRows] = useState<string[]>(['', '', ''])

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

  if (gate === 'checking') return null

  if (gate === 'anonymous') {
    return (
      <div className="ticket-card max-w-[34rem] p-6">
        <p className="eyebrow m-0 text-flame">Creators sign in first</p>
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
        <p className="eyebrow m-0 text-flame">You’re signed in as a cook</p>
        <p className="mt-2 text-slate">
          Switch this account to a creator account to publish recipes — everything you’ve saved
          stays exactly as it is.
        </p>
        <button
          type="button"
          className="btn-primary mt-5"
          onClick={async () => {
            if (!supabase) return
            const { error } = await supabase.auth.updateUser({
              data: { account_type: 'creator' },
            })
            if (!error) setGate('creator')
          }}
        >
          Become a creator
        </button>
      </div>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)

    const ingredients = ingredientRows
      .map((l) => l.trim())
      .filter(Boolean)
      .map((item) => ({ item }))
    const steps = stepRows
      .map((l) => l.trim())
      .filter(Boolean)
      .map((text) => ({ text }))

    if (!title.trim() || !cuisine || ingredients.length < 2 || steps.length < 2) {
      setNotice({
        kind: 'error',
        text: 'Needs a title, a cuisine, at least two ingredients and two steps.',
      })
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
          ...taste,
          ingredients,
          steps,
        }),
      )
      const res = await fetch('/studio/submit', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submission failed.')
      setNotice({
        kind: 'ok',
        text: 'Submitted — a human reviews it next, then it goes live under your name.',
      })
      setTitle('')
      setPhoto(null)
      setPhotoUrl(null)
      setPickerKey((k) => k + 1)
      setIngredientRows(['', '', ''])
      setStepRows(['', '', ''])
      setVideoUrl('')
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
  const previewIngredients = ingredientRows.map((l) => l.trim()).filter(Boolean)
  const previewSteps = stepRows.map((l) => l.trim()).filter(Boolean)

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
    <form onSubmit={submit} className="grid min-w-0 gap-6">
      <label className={labelCls}>
        <span className="eyebrow">Recipe title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} />
      </label>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className={labelCls}>
          <span className="eyebrow">Your photo of the dish</span>
          <ImagePicker
            key={pickerKey}
            aspect={4 / 3}
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

      <div className={labelCls}>
        <span className="eyebrow">Ingredients — one per row (paste a list to fill rows fast)</span>
        <LineListInput
          value={ingredientRows}
          onChange={setIngredientRows}
          ariaLabel="Ingredient"
          addLabel="Add ingredient"
          placeholder={(i) =>
            i === 0 ? '2 tbsp gochujang' : i === 1 ? '400g chicken thighs' : 'add another…'
          }
        />
      </div>

      <div className={labelCls}>
        <span className="eyebrow">Steps — one per row</span>
        <LineListInput
          value={stepRows}
          onChange={setStepRows}
          numbered
          ariaLabel="Step"
          addLabel="Add step"
          placeholder={(i) =>
            i === 0 ? 'Marinate the chicken in the gochujang for 20 minutes.' : 'then…'
          }
        />
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`m-0 text-[0.9375rem] ${notice.kind === 'error' ? 'text-heat' : 'text-richness'}`}
        >
          {notice.text}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary justify-self-start disabled:opacity-60">
        {busy ? 'Sending…' : 'Submit for review'}
      </button>
    </form>

    {/* Live preview — the recipe page, forming as they type. */}
    <aside aria-label="Recipe preview" className="hidden min-w-0 xl:block xl:sticky xl:top-24">
      <p className="eyebrow m-0">Live preview — how it will look</p>
      <div className="ticket-card mt-3 overflow-hidden">
        <div className="relative bg-pan text-milk">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={photoUrl} alt="" className="aspect-[16/9] w-full object-cover opacity-60" />
          ) : (
            <div className="grid aspect-[16/9] w-full place-items-center bg-pan-deep">
              <span className="font-mono text-[0.8125rem] text-milk/50">your photo lands here</span>
            </div>
          )}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-pan-deep/90 to-transparent p-5">
            <p className="eyebrow m-0 text-flame">{previewFacts.join(' · ')}</p>
            <h3 className="mt-1 font-display text-[1.75rem] leading-tight text-milk">
              {title || 'Your recipe title'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-rule p-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- account avatar
            <img src={profile.avatarUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full border border-rule object-cover" />
          ) : (
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full border border-rule bg-wash font-display">
              {(profile.name ?? 'C')[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="m-0 flex items-center gap-1.5 font-body text-[0.9375rem] font-semibold text-ink">
              <span className="truncate">{profile.name ?? 'Your name'}</span>
              {profile.verified && (
                <span title="Verified creator" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-flame text-[0.625rem] text-paper">✓</span>
              )}
            </p>
            {profile.username && (
              <p className="m-0 font-mono text-[0.75rem] text-slate">@{profile.username}</p>
            )}
          </div>
        </div>

        <div className="grid gap-5 p-4">
          <div>
            <p className="eyebrow m-0">Ingredients</p>
            <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
              {(previewIngredients.length ? previewIngredients : ['2 tbsp of something delicious…']).slice(0, 8).map((line, i) => (
                <li key={i} className="border-b border-rule pb-1.5 text-[0.9375rem] break-words [overflow-wrap:anywhere]">{line}</li>
              ))}
              {previewIngredients.length > 8 && (
                <li className="pt-1 font-mono text-[0.75rem] text-slate">+ {previewIngredients.length - 8} more</li>
              )}
            </ul>
          </div>
          <div>
            <p className="eyebrow m-0">Method</p>
            <ol className="m-0 mt-2 list-none space-y-3 p-0">
              {(previewSteps.length ? previewSteps : ['Steps appear here as you write them.']).slice(0, 4).map((step, i) => (
                <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
                  <span className="font-mono text-[0.9375rem] font-bold text-flame tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <p className="m-0 text-[0.9375rem] leading-relaxed break-words [overflow-wrap:anywhere]">{step}</p>
                </li>
              ))}
              {previewSteps.length > 4 && (
                <li className="font-mono text-[0.75rem] text-slate">+ {previewSteps.length - 4} more steps</li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </aside>
    </div>
  )
}
