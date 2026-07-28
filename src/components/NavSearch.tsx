'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type RecipeHit = {
  slug: string
  title: string
  facts: string[]
  image: { url: string; alt: string } | null
}
type CuisineHit = { slug: string; name: string; flag: string | null; count: number }
type PageHit = { href: string; title: string }
type Payload = { results: RecipeHit[]; cuisines: CuisineHit[]; pages: PageHit[] }

/** One keyboard-navigable row, whatever section it renders in. */
type Option = { key: string; href: string; query?: string }

const RECENTS_KEY = 'palate_recent_searches'
const MAX_RECENTS = 5

const QUICK_LINKS = [
  { href: '/tonight', label: 'Pick dinner for me' },
  { href: '/taste-night', label: 'Taste Night quiz' },
  { href: '/students', label: 'Studying hard?' },
  { href: '/recipes', label: 'Browse everything' },
]

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === 'string') : []
  } catch {
    return []
  }
}

/** Bolds the matched substring so the eye lands on why this row is here. */
function Highlight({ text, q }: { text: string; q: string }) {
  const at = text.toLowerCase().indexOf(q.toLowerCase())
  if (at < 0 || !q) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-bold text-flame">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

/**
 * The pass's search rail, upgraded to a small command palette:
 *
 *  · "/" or ⌘K focuses it from anywhere (a visible kbd hint teaches this).
 *  · Focused but empty, it offers recent searches and quick destinations
 *    instead of a dead dropdown.
 *  · Results come grouped — cuisines, recipes with quick facts, then site
 *    pages — with the matched substring highlighted, and an honest
 *    "nothing matched" row instead of silence.
 *  · One flat keyboard order runs through every row; the footer teaches the
 *    keys. Enter with nothing highlighted falls through to full search.
 */
export function NavSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [data, setData] = useState<Payload | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [recents, setRecents] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = query.trim()
  const idle = q.length < 2

  // --- Global shortcut: "/" or ⌘K -----------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if ((event.key === '/' && !typing) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setRecents(readRecents()), [])

  // --- Fetch on keystroke ---------------------------------------------------
  useEffect(() => {
    if (idle) {
      setData(null)
      setHighlight(-1)
      return
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      fetch(`/search-suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: Payload | null) => {
          if (payload) {
            setData(payload)
            setOpen(true)
            setHighlight(-1)
          }
        })
        .catch(() => {})
    }, 150)
    return () => clearTimeout(timer)
  }, [q, idle])

  // --- Click-away -----------------------------------------------------------
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const rememberSearch = useCallback((term: string) => {
    if (!term) return
    setRecents((prev) => {
      const next = [term, ...prev.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(
        0,
        MAX_RECENTS,
      )
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  // Flat keyboard order mirroring the render order below.
  const options: Option[] = useMemo(() => {
    if (idle || !data) return []
    const list: Option[] = []
    for (const c of data.cuisines) list.push({ key: `c-${c.slug}`, href: `/cuisine/${c.slug}` })
    for (const r of data.results) list.push({ key: `r-${r.slug}`, href: `/recipes/${r.slug}` })
    for (const p of data.pages) list.push({ key: `p-${p.href}`, href: p.href })
    list.push({ key: 'all', href: `/recipes?q=${encodeURIComponent(q)}`, query: q })
    return list
  }, [data, idle, q])

  const go = useCallback(
    (option: Option) => {
      setOpen(false)
      setQuery('') // a committed search is done — reopening starts fresh
      inputRef.current?.blur()
      rememberSearch(option.query ?? q)
      router.push(option.href)
    },
    [q, rememberSearch, router],
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault()
      setHighlight((h) => (h + 1) % options.length)
    } else if (event.key === 'ArrowUp' && options.length > 0) {
      event.preventDefault()
      setHighlight((h) => (h <= 0 ? options.length - 1 : h - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = highlight >= 0 ? options[highlight] : options[options.length - 1]
      if (target) go(target)
    } else if (event.key === 'Escape') {
      if (open) setOpen(false)
      else inputRef.current?.blur()
    }
  }

  const optionIndexByKey = new Map(options.map((o, i) => [o.key, i]))
  const rowClass = (key: string) =>
    `flex cursor-pointer items-center gap-3 rounded p-2 ${
      optionIndexByKey.get(key) === highlight ? 'bg-wash' : ''
    }`
  const rowProps = (key: string, option: Option) => ({
    role: 'option' as const,
    'aria-selected': optionIndexByKey.get(key) === highlight,
    id: `nav-search-option-${optionIndexByKey.get(key)}`,
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      go(option)
    },
    onPointerMove: () => setHighlight(optionIndexByKey.get(key) ?? -1),
  })

  const showIdlePanel = open && focused && idle && (recents.length > 0 || true)
  const showResults = open && !idle && data !== null
  const empty =
    showResults && data.results.length === 0 && data.cuisines.length === 0 && data.pages.length === 0

  const sectionLabel = (text: string) => (
    <li
      aria-hidden="true"
      className="px-2 pt-2.5 pb-1 font-mono text-[0.8125rem] font-semibold tracking-[0.16em] text-slate uppercase first:pt-1"
    >
      {text}
    </li>
  )

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-md">
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 fill-none stroke-milk/50 stroke-[2]"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m13.5 13.5 4 4" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showResults || showIdlePanel}
          aria-controls="nav-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `nav-search-option-${highlight}` : undefined}
          aria-label="Search recipes, cuisines, and pages"
          placeholder="Search recipes, cuisines…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true)
            setOpen(true)
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          className="w-full rounded border border-milk/25 bg-transparent py-2 pr-9 pl-9 font-mono text-[0.8125rem] text-milk placeholder:text-milk/75 focus:border-flame focus:outline-none"
        />
        {!focused && !query && (
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-milk/25 px-1.5 py-0.5 font-mono text-[0.8125rem] text-milk/55 sm:block">
            /
          </kbd>
        )}
      </div>

      {(showResults || showIdlePanel) && (
        <div
          id="nav-search-listbox"
          role="listbox"
          aria-label="Search suggestions"
          // On phones the search box is narrow (it shares the header row), so the
          // panel breaks out to a near-full-width fixed sheet under the header
          // instead of being pinned to the box's width.
          className="scroll-rail absolute top-full right-0 left-0 z-50 mt-2 max-h-[72vh] overflow-y-auto rounded-md border border-ink/30 bg-card p-1.5 text-ink shadow-(--shadow-block) max-sm:fixed max-sm:inset-x-2 max-sm:top-16 max-sm:mt-0 max-sm:max-h-[70vh]"
        >
          {showIdlePanel ? (
            <ul className="m-0 list-none p-0">
              {recents.length > 0 && (
                <>
                  {sectionLabel('Recent')}
                  {recents.map((term) => (
                    <li
                      key={term}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded p-2 hover:bg-wash"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setQuery(term)
                        inputRef.current?.focus()
                      }}
                    >
                      <span className="truncate font-mono text-[0.8125rem] text-ink">↻ {term}</span>
                    </li>
                  ))}
                  <li className="px-2 pb-1">
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setRecents([])
                        try {
                          localStorage.removeItem(RECENTS_KEY)
                        } catch {}
                      }}
                      className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.12em] text-slate uppercase hover:underline"
                    >
                      Clear recent
                    </button>
                  </li>
                </>
              )}
              {sectionLabel('Go to')}
              {QUICK_LINKS.map((link) => (
                <li
                  key={link.href}
                  className="cursor-pointer rounded p-2 font-mono text-[0.8125rem] text-ink hover:bg-wash"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    setOpen(false)
                    router.push(link.href)
                  }}
                >
                  {link.label} <span className="text-slate">→</span>
                </li>
              ))}
            </ul>
          ) : empty ? (
            <div className="p-3">
              <p className="m-0 font-mono text-[0.8125rem] text-slate">
                Nothing on the board matches “{q}”.
              </p>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault()
                  go({ key: 'all', href: `/recipes?q=${encodeURIComponent(q)}`, query: q })
                }}
                className="mt-2 cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.12em] text-flame uppercase hover:underline"
              >
                Search the whole board anyway →
              </button>
            </div>
          ) : (
            data && (
              <ul className="m-0 list-none p-0">
                {data.cuisines.length > 0 && sectionLabel('Cuisines')}
                {data.cuisines.map((cuisine) => (
                  <li
                    key={`c-${cuisine.slug}`}
                    className={rowClass(`c-${cuisine.slug}`)}
                    {...rowProps(`c-${cuisine.slug}`, {
                      key: `c-${cuisine.slug}`,
                      href: `/cuisine/${cuisine.slug}`,
                    })}
                  >
                    <span className="grid h-[33px] w-[44px] shrink-0 place-items-center rounded-sm bg-wash text-base">
                      {cuisine.flag ?? '◈'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-body text-[0.9375rem] font-medium">
                        <Highlight text={cuisine.name} q={q} /> cuisine
                      </span>
                      <span className="mt-0.5 block font-mono text-[0.8125rem] tracking-[0.06em] text-slate uppercase">
                        {cuisine.count} recipes · hub page
                      </span>
                    </span>
                  </li>
                ))}

                {data.results.length > 0 && sectionLabel('Recipes')}
                {data.results.map((recipe) => (
                  <li
                    key={`r-${recipe.slug}`}
                    className={rowClass(`r-${recipe.slug}`)}
                    {...rowProps(`r-${recipe.slug}`, {
                      key: `r-${recipe.slug}`,
                      href: `/recipes/${recipe.slug}`,
                    })}
                  >
                    {recipe.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- tiny client-fetched thumbs
                      <img
                        src={recipe.image.url}
                        alt=""
                        width={44}
                        height={33}
                        className="h-[33px] w-[44px] shrink-0 rounded-sm object-cover"
                      />
                    ) : (
                      <span aria-hidden="true" className="h-[33px] w-[44px] shrink-0 rounded-sm bg-wash" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-body text-[0.9375rem] font-medium">
                        <Highlight text={recipe.title} q={q} />
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[0.8125rem] tracking-[0.06em] text-slate uppercase">
                        {recipe.facts.join(' · ')}
                      </span>
                    </span>
                  </li>
                ))}

                {data.pages.length > 0 && sectionLabel('Pages')}
                {data.pages.map((page) => (
                  <li
                    key={`p-${page.href}`}
                    className={rowClass(`p-${page.href}`)}
                    {...rowProps(`p-${page.href}`, { key: `p-${page.href}`, href: page.href })}
                  >
                    <span className="grid h-[33px] w-[44px] shrink-0 place-items-center rounded-sm bg-wash font-mono text-[0.8125rem]">
                      ↦
                    </span>
                    <span className="font-body text-[0.9375rem] font-medium">
                      <Highlight text={page.title} q={q} />
                    </span>
                  </li>
                ))}

                <li
                  className={`${rowClass('all')} justify-center`}
                  {...rowProps('all', {
                    key: 'all',
                    href: `/recipes?q=${encodeURIComponent(q)}`,
                    query: q,
                  })}
                >
                  <span className="font-mono text-[0.8125rem] tracking-[0.12em] text-flame uppercase">
                    All results for “{q}” →
                  </span>
                </li>
              </ul>
            )
          )}

          <div
            aria-hidden="true"
            className="mt-1 flex items-center gap-3 border-t border-rule px-2 pt-1.5 pb-0.5 font-mono text-[0.8125rem] tracking-[0.08em] text-slate"
          >
            <span>↑↓ move</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        </div>
      )}
    </div>
  )
}
