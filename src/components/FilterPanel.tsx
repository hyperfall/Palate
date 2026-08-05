'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  CALORIE_MAX,
  CALORIE_MIN,
  CALORIE_STEP,
  catalogHref,
  countActiveFilters,
  RATING_CHOICES,
  type CatalogFilters,
  type SortKey,
  type TasteRange,
} from '@/lib/filters'
import {
  ALLERGEN_TAGS,
  ALLERGENS,
  COURSES,
  DIFFICULTIES,
  LIFESTYLE_DIETS,
  MAIN_INGREDIENTS,
  TASTE_AXES,
  TASTE_AXIS_LABELS,
  TIME_BUCKETS,
  tasteLabel,
  type TasteAxis,
} from '@/lib/taxonomy'
import { fetchTasteProfile } from '@/lib/tasteProfileStore'
import { AXIS_COLOR } from './TasteGauge'

/**
 * The filter station (design spec §7).
 *
 * Filter state lives entirely in the URL — every interaction rewrites the
 * query string via the router, so any state remains shareable and crawlable.
 * On desktop the station is sticky: the controls stay at hand while the grid
 * scrolls. On mobile it collapses to one bar so recipes stay first.
 */

type CuisineOption = { name: string; slug: string; flagEmoji?: string | null }

const LEVELS = [0, 1, 2, 3, 4, 5]

function useCommit(filters: CatalogFilters) {
  const router = useRouter()
  return (mutate: (draft: CatalogFilters) => void) => {
    const draft: CatalogFilters = {
      ...filters,
      cuisines: [...filters.cuisines],
      courses: [...filters.courses],
      ingredients: [...filters.ingredients],
      diets: [...filters.diets],
      difficulties: [...filters.difficulties],
      taste: { ...filters.taste },
    }
    mutate(draft)
    draft.page = 1 // any narrowing restarts pagination
    router.replace(catalogHref(draft), { scroll: false })
  }
}

/**
 * The taste band — the site's meter, operated as a range.
 *
 * Tap a level to pick it; tap a second level to widen the band between them;
 * tap inside an existing band to restart from that level. "Any" clears.
 */
function TasteBand({
  axis,
  range,
  onChange,
}: {
  axis: TasteAxis
  range: TasteRange | null
  onChange: (next: TasteRange | null) => void
}) {
  const meta = TASTE_AXIS_LABELS[axis]

  const readout = !range
    ? 'Any'
    : range.min === range.max
      ? tasteLabel(axis, range.min)
      : `${tasteLabel(axis, range.min)} – ${tasteLabel(axis, range.max)}`

  const pick = (level: number) => {
    if (!range) return onChange({ min: level, max: level })
    if (level < range.min) return onChange({ min: level, max: range.max })
    if (level > range.max) return onChange({ min: range.min, max: level })
    return onChange({ min: level, max: level })
  }

  return (
    <div style={{ ['--gauge-hue' as string]: AXIS_COLOR[axis] }}>
      <div className="leader">
        <span className="eyebrow">{meta.title}</span>
        <span className="leader__dots" aria-hidden="true" />
        <span className="flex items-baseline gap-2">
          <span className="datum">{readout}</span>
          {range && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="cursor-pointer border-none bg-transparent p-0 font-mono text-detail font-medium text-flame underline-offset-2 hover:underline"
            >
              Any
            </button>
          )}
        </span>
      </div>

      <div className="mt-1 flex items-end gap-[3px]">
        {LEVELS.map((level) => {
          const inBand = range !== null && level >= range.min && level <= range.max
          return (
            <button
              key={level}
              type="button"
              className="axis-btn"
              aria-pressed={inBand}
              aria-label={`${meta.title}: ${tasteLabel(axis, level)}`}
              onClick={() => pick(level)}
            >
              <span
                className="axis-tick"
                style={{
                  height: inBand ? '1.125rem' : `${0.375 + level * 0.1}rem`,
                  ['--tick-strength' as string]: inBand ? '100%' : '30%',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

function FacetGroup({
  label,
  hint,
  activeCount = 0,
  defaultOpen = true,
  children,
}: {
  label: string
  hint?: string
  /** Number of active selections in this group — shown as a flame badge. */
  activeCount?: number
  /** Whether this group starts expanded. Primary axes (Meal, Taste, Time, …)
      pass true; secondary/long lists pass false to keep the panel scannable. */
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  // A group with an active selection always opens so the choice stays visible.
  const [open, setOpen] = useState(defaultOpen || activeCount > 0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const regionId = `facet-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  const toggle = () => {
    setOpen((wasOpen) => {
      // Collapsing unmounts the content; if focus was inside it, pull focus back
      // to the header so it never silently drops to <body>.
      if (wasOpen && contentRef.current?.contains(document.activeElement)) {
        btnRef.current?.focus()
      }
      return !wasOpen
    })
  }

  return (
    <div className="border-t border-rule pt-4">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={regionId}
        className="group/facet flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent p-0 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="eyebrow m-0 text-ink transition-colors group-hover/facet:text-flame">
            {label}
          </span>
          {activeCount > 0 && (
            <span className="grid h-[1.1rem] min-w-[1.1rem] place-items-center rounded-full bg-flame px-1 font-mono text-micro font-semibold text-paper tabular-nums">
              {activeCount}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {hint && open && (
            <span className="font-mono text-caption tracking-[0.04em] text-slate">{hint}</span>
          )}
          <svg
            width="11"
            height="7"
            viewBox="0 0 11 7"
            aria-hidden="true"
            className={`fill-none stroke-slate stroke-[1.5] transition-[transform,stroke] group-hover/facet:stroke-flame ${open ? 'rotate-180' : ''}`}
          >
            <path d="M1 1l4.5 4L10 1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div id={regionId} ref={contentRef} role="group" aria-label={label} className="mt-3">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * A labelled region grouping several facets, so the panel reads as a few rooms
 * rather than a flat list of a dozen. `accent` gives Taste a quiet signature —
 * a flame edge + faint wash — marking it the centrepiece without a loud hero
 * treatment (taste is a feature, not a shouting moat).
 */
function Section({
  title,
  accent = false,
  children,
}: {
  title: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={accent ? 'rounded-r-lg border-l-2 border-flame/40 bg-flame/[0.035] pb-3 pl-3.5' : ''}>
      <p
        className={`m-0 pt-3 pb-0.5 font-mono text-micro font-bold tracking-[0.18em] uppercase ${
          accent ? 'text-flame' : 'text-slate/55'
        }`}
      >
        {title}
      </p>
      <div className="grid gap-5">{children}</div>
    </div>
  )
}

/**
 * Calorie ceiling — a continuous slider instead of three fixed buckets.
 * Drags live; commits to the URL only on release so the router isn't spammed.
 * Sliding to the top means "no ceiling".
 */
function CalorieBand({
  value,
  onCommit,
}: {
  value: number | null
  onCommit: (next: number | null) => void
}) {
  const [draft, setDraft] = useState<number>(value ?? CALORIE_MAX)
  useEffect(() => setDraft(value ?? CALORIE_MAX), [value])

  const atMax = draft >= CALORIE_MAX
  const commit = () => onCommit(atMax ? null : draft)
  // Fraction of the track the flame fill covers, for the WebKit gradient.
  const fillPct = ((draft - CALORIE_MIN) / (CALORIE_MAX - CALORIE_MIN)) * 100

  return (
    <div>
      <div className="leader">
        <span className="datum">{atMax ? 'Any' : `Under ${draft} kcal`}</span>
        <span className="leader__dots" aria-hidden="true" />
        {value !== null && (
          <button
            type="button"
            onClick={() => onCommit(null)}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-detail font-medium text-flame underline-offset-2 hover:underline"
          >
            Any
          </button>
        )}
      </div>
      <input
        type="range"
        min={CALORIE_MIN}
        max={CALORIE_MAX}
        step={CALORIE_STEP}
        value={draft}
        aria-label="Maximum calories per serving"
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        style={{ ['--fill' as string]: `${fillPct}%` }}
        className="slider mt-2"
      />
      <div className="mt-1 flex justify-between font-mono text-caption text-slate tabular-nums">
        <span>{CALORIE_MIN}</span>
        <span>{CALORIE_MAX}+ kcal</span>
      </div>
    </div>
  )
}

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'quickest', label: 'Quickest' },
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'top', label: 'Top rated' },
  { value: 'foryou', label: 'For your taste' },
  ...TASTE_AXES.map((axis) => ({
    value: axis,
    label: `Most ${TASTE_AXIS_LABELS[axis].title.toLowerCase()}`,
  })),
]

const EQUIPMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'stovetop', label: 'Stovetop' },
  { value: 'oven', label: 'Oven' },
  { value: 'grill', label: 'Grill' },
  { value: 'no-cook', label: 'No-cook' },
  { value: 'blender', label: 'Blender' },
  { value: 'food-processor', label: 'Food processor' },
]
const COST_BUCKETS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Any' },
  { value: 200, label: '≤ £2' },
  { value: 300, label: '≤ £3' },
  { value: 500, label: '≤ £5' },
]

export function FilterPanel({
  filters,
  cuisines,
  availableAllergens = [],
}: {
  filters: CatalogFilters
  cuisines: CuisineOption[]
  /** Allergen tags with ≥1 tagged recipe — the only ones worth offering. */
  availableAllergens?: string[]
}) {
  const commit = useCommit(filters)
  const activeCount = countActiveFilters(filters)
  const [open, setOpen] = useState(false)

  // One place both the desktop header and the mobile drawer clear from.
  const clearAll = () => {
    setQuery('')
    commit((d) => {
      d.cuisines = []
      d.courses = []
      d.ingredients = []
      d.diets = []
      d.difficulties = []
      d.taste = {}
      d.maxMinutes = null
      d.maxCalories = null
      d.minRating = null
      d.maxCost = null
      d.equipment = []
      d.onePan = false
      d.makeAhead = false
      d.keepsWell = false
      d.tasteVector = null
      d.q = ''
    })
  }

  // Mobile drawer as a real dialog: lock body scroll, trap Tab, close on Escape,
  // move focus in on open and restore it to the trigger on close.
  const drawerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreTo = triggerRef.current
    const focusables = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled'))
    // Focus the dialog itself (tabindex -1). A short timeout (not rAF) lands
    // reliably after the open click and mount settle.
    const focusTimer = setTimeout(() => drawerRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(focusTimer)
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      restoreTo?.focus?.()
    }
  }, [open])

  // Debounced title search. The ref dance keeps typing responsive while the
  // URL (and the server-rendered results) trail by a beat.
  const [query, setQuery] = useState(filters.q)
  const commitRef = useRef(commit)
  commitRef.current = commit

  // `useState(filters.q)` only seeds the input on first mount. Without this,
  // a `filters.q` change that didn't originate from typing here — back/forward
  // navigation, or another control clearing all filters — would leave the box
  // showing stale text, and the debounce effect below would then fight it by
  // writing that stale text back into the URL after 350ms.
  const lastFiltersQ = useRef(filters.q)
  useEffect(() => {
    if (filters.q !== lastFiltersQ.current) {
      lastFiltersQ.current = filters.q
      setQuery(filters.q)
    }
  }, [filters.q])

  useEffect(() => {
    if (query === filters.q) return
    const t = setTimeout(() => {
      lastFiltersQ.current = query.trim()
      commitRef.current((d) => void (d.q = query.trim()))
    }, 350)
    return () => clearTimeout(t)
  }, [query, filters.q])

  const toggleIn = (
    list: 'cuisines' | 'courses' | 'ingredients' | 'diets' | 'difficulties',
    value: string,
  ) =>
    commit((d) => {
      d[list] = d[list].includes(value) ? d[list].filter((v) => v !== value) : [...d[list], value]
    })

  const panelBody = useMemo(
    () => (
      <div className="grid gap-6">
        <label className="block">
          <span className="sr-only">Search recipes</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes…"
            className="w-full rounded border border-edge bg-transparent px-3.5 py-2.5 font-mono text-detail text-ink placeholder:text-slate focus:border-ink focus:outline-none"
          />
        </label>

        {/* The dish — what it is, before how it tastes. */}
        <Section title="The dish">
          <FacetGroup label="Meal" activeCount={filters.courses.length}>
            <div className="flex flex-wrap gap-2">
              {COURSES.map((course) => (
                <Chip
                  key={course.value}
                  active={filters.courses.includes(course.value)}
                  onClick={() => toggleIn('courses', course.value)}
                >
                  {course.label}
                </Chip>
              ))}
            </div>
          </FacetGroup>

          <FacetGroup label="Built on" activeCount={filters.ingredients.length} defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {MAIN_INGREDIENTS.map((ingredient) => (
                <Chip
                  key={ingredient.value}
                  active={filters.ingredients.includes(ingredient.value)}
                  onClick={() => toggleIn('ingredients', ingredient.value)}
                >
                  {ingredient.label}
                </Chip>
              ))}
            </div>
          </FacetGroup>

          <FacetGroup
            label="Cuisine"
            activeCount={filters.cuisines.length}
            defaultOpen={cuisines.length <= 12}
          >
            <div className="flex flex-wrap gap-2">
              {cuisines.map((cuisine) => (
                <Chip
                  key={cuisine.slug}
                  active={filters.cuisines.includes(cuisine.slug)}
                  onClick={() => toggleIn('cuisines', cuisine.slug)}
                >
                  {cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}
                  {cuisine.name}
                </Chip>
              ))}
            </div>
          </FacetGroup>
        </Section>

        {/* Taste — the centrepiece, given a quiet flame signature. Quality
            (Rating) rides here too: how good, alongside how it tastes. */}
        <Section title="Taste" accent>
          <FacetGroup
            label="Taste"
            hint="tap · again to widen"
            activeCount={Object.keys(filters.taste).length}
          >
            <div className="grid gap-4">
              {TASTE_AXES.map((axis) => (
                <TasteBand
                  key={axis}
                  axis={axis}
                  range={filters.taste[axis] ?? null}
                  onChange={(next) =>
                    commit((d) => {
                      if (next) d.taste[axis] = next
                      else delete d.taste[axis]
                    })
                  }
                />
              ))}
            </div>
          </FacetGroup>

          <FacetGroup label="Rating" activeCount={filters.minRating !== null ? 1 : 0}>
            <div className="flex flex-wrap gap-2">
              <Chip
                active={filters.minRating === null}
                onClick={() => commit((d) => void (d.minRating = null))}
              >
                Any
              </Chip>
              {RATING_CHOICES.map((threshold) => {
                const active = filters.minRating === threshold
                return (
                  <Chip
                    key={threshold}
                    active={active}
                    onClick={() =>
                      commit((d) => void (d.minRating = active ? null : threshold))
                    }
                  >
                    {threshold}★+
                  </Chip>
                )
              })}
            </div>
          </FacetGroup>
        </Section>

        {/* Time & effort — the practical constraints of a weeknight. */}
        <Section title="Time & effort">
          <FacetGroup label="Time" activeCount={filters.maxMinutes !== null ? 1 : 0}>
            <div className="flex flex-wrap gap-2">
              {TIME_BUCKETS.map((bucket) => {
                const isAny = bucket.value === 'any'
                const active = isAny ? filters.maxMinutes === null : filters.maxMinutes === bucket.max
                return (
                  <Chip
                    key={bucket.value}
                    active={active}
                    onClick={() =>
                      commit((d) => {
                        d.maxMinutes = isAny || active ? null : (bucket.max as number)
                      })
                    }
                  >
                    {bucket.label}
                  </Chip>
                )
              })}
            </div>
          </FacetGroup>

          <FacetGroup label="Difficulty" activeCount={filters.difficulties.length}>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((level) => (
                <Chip
                  key={level.value}
                  active={filters.difficulties.includes(level.value)}
                  onClick={() => toggleIn('difficulties', level.value)}
                >
                  {level.label}
                </Chip>
              ))}
            </div>
          </FacetGroup>

          <FacetGroup
            label="Kitchen"
            activeCount={
              filters.equipment.length +
              (filters.onePan ? 1 : 0) +
              (filters.makeAhead ? 1 : 0) +
              (filters.keepsWell ? 1 : 0)
            }
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2">
              <Chip active={filters.onePan} onClick={() => commit((d) => void (d.onePan = !d.onePan))}>
                One pan
              </Chip>
              <Chip active={filters.makeAhead} onClick={() => commit((d) => void (d.makeAhead = !d.makeAhead))}>
                Make-ahead
              </Chip>
              <Chip active={filters.keepsWell} onClick={() => commit((d) => void (d.keepsWell = !d.keepsWell))}>
                Keeps well
              </Chip>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  active={filters.equipment.includes(o.value)}
                  onClick={() =>
                    commit((d) => {
                      d.equipment = d.equipment.includes(o.value)
                        ? d.equipment.filter((x) => x !== o.value)
                        : [...d.equipment, o.value]
                    })
                  }
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </FacetGroup>

          <FacetGroup
            label="Budget"
            hint="per serving"
            activeCount={filters.maxCost !== null ? 1 : 0}
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2">
              {COST_BUCKETS.map((b) => (
                <Chip
                  key={b.label}
                  active={b.value === null ? filters.maxCost === null : filters.maxCost === b.value}
                  onClick={() => commit((d) => void (d.maxCost = b.value))}
                >
                  {b.label}
                </Chip>
              ))}
            </div>
          </FacetGroup>

          <FacetGroup
            label="Calories"
            hint="per serving"
            activeCount={filters.maxCalories !== null ? 1 : 0}
          >
            <CalorieBand
              value={filters.maxCalories}
              onCommit={(next) => commit((d) => void (d.maxCalories = next))}
            />
          </FacetGroup>
        </Section>

        {/* Dietary — needs and restrictions, kept together at the foot. */}
        <Section title="Dietary">
          <FacetGroup
            label="Diet"
            activeCount={filters.diets.filter((d) => !ALLERGEN_TAGS.has(d)).length}
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2">
              {LIFESTYLE_DIETS.map((tag) => (
                <Chip
                  key={tag.value}
                  active={filters.diets.includes(tag.value)}
                  onClick={() => toggleIn('diets', tag.value)}
                >
                  {tag.label}
                </Chip>
              ))}
            </div>
          </FacetGroup>

          {/*
            Allergens, framed as what to avoid. Selecting "Nuts" filters to
            recipes explicitly tagged nut-free — it shows tagged-safe dishes, never
            an inference that an untagged recipe is safe. The hint says so plainly.
            Only allergens with tagged coverage appear, so no chip dead-ends on an
            empty page; the whole group hides until at least one has coverage.
          */}
          {ALLERGENS.some((a) => availableAllergens.includes(a.tag)) && (
            <FacetGroup
              label="Avoiding"
              activeCount={filters.diets.filter((d) => ALLERGEN_TAGS.has(d)).length}
              defaultOpen={false}
            >
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.filter((a) => availableAllergens.includes(a.tag)).map((allergen) => (
                  <Chip
                    key={allergen.tag}
                    active={filters.diets.includes(allergen.tag)}
                    onClick={() => toggleIn('diets', allergen.tag)}
                  >
                    {allergen.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-2.5 text-caption leading-snug text-slate">
                Shows only recipes tagged free of the allergen. Untagged dishes aren’t assumed safe.
              </p>
            </FacetGroup>
          )}
        </Section>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt whenever the URL-derived filters change
    [filters, query, cuisines, availableAllergens],
  )

  const clearButtonClass =
    'cursor-pointer border-none bg-transparent p-0 font-mono text-detail font-medium tracking-[0.1em] text-flame uppercase underline-offset-2 hover:underline'

  return (
    <aside aria-label="Filter recipes">
      {/* Mobile: a compact bar; recipes stay the first real content. */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          className="chip"
          data-active={open || activeCount > 0}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="filter-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
        <SortSelect filters={filters} />
      </div>

      {/* Mobile drawer — a real dialog: dimmed overlay, scroll-lock, Escape,
          focus trap + restore (see the effect above). */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-pan-deep/60" onClick={() => setOpen(false)} />
          <div
            ref={drawerRef}
            id="filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Filter recipes"
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-xl border-t border-rule bg-paper outline-none"
          >
            <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <p className="eyebrow m-0 text-ink">
                Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
              </p>
              <div className="flex items-center gap-4">
                {activeCount > 0 && (
                  <button type="button" onClick={clearAll} className={clearButtonClass}>
                    Clear {activeCount}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close filters"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-ink hover:border-heat hover:text-heat"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="scroll-rail flex-1 overflow-y-auto px-5 py-4">{panelBody}</div>
          </div>
        </div>
      )}

      {/*
        Desktop: the whole filter column stands at full height and the PAGE
        scrolls past it.

        It used to be a viewport-tall box with its own inner scrollbar and a
        "more ↓" hint. Every facet was rendered, but you could only ever see a
        slice of them — the cuisine list alone ran past the fold, so which
        kitchens the catalogue offered was a thing you had to discover by
        scrolling a panel most people never realised scrolled. A filter's job is
        to show what is on offer.

        `sticky top-20` still holds it in view while the grid scrolls, but with
        no max-height it simply unsticks and scrolls away once the column is
        taller than the viewport, which is the behaviour every large catalogue
        uses. No inner scroll, no fades, no hint needed.
      */}
      <div className="hidden lg:block">
        <div className="sticky top-20">
          <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-3">
            <p className="eyebrow m-0 text-ink">Filter</p>
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className={clearButtonClass}>
                Clear {activeCount}
              </button>
            )}
          </div>
          <div className="pt-4 pb-4">{panelBody}</div>
        </div>
      </div>
    </aside>
  )
}

export function SortSelect({ filters }: { filters: CatalogFilters }) {
  const commit = useCommit(filters)

  return (
    <label className="inline-flex items-center gap-2">
      <span className="eyebrow">Sort</span>
      <select
        value={filters.sort}
        onChange={async (e) => {
          const value = e.target.value as SortKey
          // Attach the saved taste profile (from Supabase) so the server can rank
          // by it; a visitor with no profile just gets the newest-order fallback.
          const tv = value === 'foryou' ? await fetchTasteProfile() : null
          commit((d) => {
            d.sort = value
            d.tasteVector = tv
          })
        }}
        className="cursor-pointer appearance-none rounded border border-edge bg-transparent py-1.5 pr-8 pl-2.5 font-mono text-detail font-medium text-ink focus:border-flame focus:outline-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.625rem center',
          backgroundSize: '10px 6px',
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
