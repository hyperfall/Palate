'use client'

import { useEffect, useRef, useState } from 'react'

import { RecipeCard } from '@/components/RecipeCard'
import type { Recipe } from '@/payload-types'

/**
 * The catalog grid with scroll-to-load. The server renders batch one; when the
 * reader nears the bottom, the next page streams in from /recipes/feed — a
 * 10,000-recipe catalog never renders 10,000 cards.
 *
 * The affordance is a frosted band pinned to the viewport's bottom edge while
 * more recipes remain: the last row blurs away under it, saying "keep going"
 * without a button. It lifts once the catalog is exhausted (or while a fetch
 * is in flight, briefly showing the loading line instead).
 *
 * Filter changes remount this component (the page keys it by the query
 * string), so accumulated results never leak across filter states.
 */
export function CatalogGrid({
  initial,
  page,
  totalPages,
  feedQuery,
}: {
  initial: Recipe[]
  page: number
  totalPages: number
  feedQuery: string
}) {
  const [recipes, setRecipes] = useState<Recipe[]>(initial)
  const [nextPage, setNextPage] = useState(page + 1)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  // The frosted band answers "is there more below me?" — which is true while
  // pages remain unloaded OR the reader simply isn't at the bottom yet. Tied
  // only to unloaded pages, a small catalog auto-fills instantly and the band
  // vanishes before anyone sees it.
  const [atBottom, setAtBottom] = useState(false)
  const hasMore = nextPage <= totalPages
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  useEffect(() => {
    const check = () =>
      setAtBottom(window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 60)
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check, { passive: true })
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [recipes.length])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const load = () => {
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      setFailed(false)
      const qs = feedQuery ? `${feedQuery}&page=${nextPage}` : `page=${nextPage}`
      fetch(`/recipes/feed?${qs}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: { recipes: Recipe[] }) => {
          // Defence in depth against overlapping pages (e.g. a recipe published
          // mid-scroll shifting the offsets): never append a card twice.
          setRecipes((prev) => {
            const seen = new Set(prev.map((r) => r.id))
            return [...prev, ...data.recipes.filter((r) => !seen.has(r.id))]
          })
          setNextPage((n) => n + 1)
        })
        .catch(() => setFailed(true))
        .finally(() => {
          loadingRef.current = false
          setLoading(false)
        })
    }

    // Fetch a comfortable screen before the reader arrives.
    const MARGIN = 600
    const near = () => el.getBoundingClientRect().top < window.innerHeight + MARGIN

    // IntersectionObserver is the efficient path — but its callbacks ride the
    // compositor, and some embedded/odd environments never deliver them. A
    // throttled scroll/resize measurement backs it up, and also covers the
    // "sentinel already in view on mount" case deterministically (short pages
    // keep loading until they fill the viewport).
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) load()
            },
            { rootMargin: `${MARGIN}px 0px` },
          )
        : null
    io?.observe(el)

    let throttle: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      if (throttle) return
      throttle = setTimeout(() => {
        throttle = null
        if (near()) load()
      }, 150)
    }
    if (near()) load()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      io?.disconnect()
      if (throttle) clearTimeout(throttle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [hasMore, nextPage, feedQuery])

  return (
    <div className="relative">
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3 min-[110rem]:grid-cols-4">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>

      {/* Load trigger — invisible, a screen ahead of the bottom. */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

      {failed && (
        <p className="mt-6 text-center font-mono text-[0.75rem] tracking-[0.08em] text-heat uppercase">
          Couldn't load more — scroll to retry.
        </p>
      )}

      {/* The frosted edge: pinned to the viewport bottom while more remains,
          blurring the last row away so the page visibly continues. Gone the
          moment the catalog is fully on the page. */}
      {(hasMore || !atBottom) && (
        <div
          aria-hidden="true"
          className="pointer-events-none sticky bottom-0 -mt-28 flex h-28 items-end justify-center bg-gradient-to-t from-paper via-paper/70 to-transparent pb-3 backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black_55%,transparent)]"
        >
          <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-slate uppercase">
            {loading ? 'Plating more…' : 'More below ↓'}
          </span>
        </div>
      )}
    </div>
  )
}
