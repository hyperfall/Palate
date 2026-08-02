'use client'

import { useEffect, useState } from 'react'

import { activeSection, type RecipeSection } from '@/lib/recipeContents'

/** Below this, the page is one column; at and above it, the ingredients pin
 *  beside the method. Matches the lg: breakpoint the layout uses. */
const SINGLE_COLUMN = '(max-width: 1023px)'

/** The sticky header, plus enough room that a section counts as current once
 *  it reaches the reading zone rather than the instant it appears. */
const READING_LINE = 140

/**
 * The recipe page's contents list, marking the section you are in.
 *
 * The marking only runs on a single-column layout, and that is a correctness
 * decision rather than a saving. Once the ingredients pin beside the method
 * the two are side by side — the ingredient rail is permanently on screen and
 * the method starts *above* it — so there is no honest answer to "which one
 * are you in". A wide screen shows you the structure anyway; a phone is where
 * a twenty-line ingredient list stands between you and the cooking.
 *
 * Everything degrades to plain anchors: no JavaScript, no matchMedia, or a
 * section that never renders all leave working links.
 */
export function RecipeContents({ sections }: { sections: RecipeSection[] }) {
  const [active, setActive] = useState('')
  // Depend on the ids, not the array: the parent is a server component, but a
  // fresh array identity on any re-render would tear the listener down.
  const ids = sections.map((s) => s.id).join(',')

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia(SINGLE_COLUMN)
    let frame = 0

    const measure = () => {
      frame = 0
      const tops = ids
        .split(',')
        .map((id) => {
          const el = document.getElementById(id)
          return el ? { id, top: el.getBoundingClientRect().top } : null
        })
        .filter((t): t is { id: string; top: number } => t !== null)
      setActive(activeSection(tops, READING_LINE))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    const attach = () => {
      window.removeEventListener('scroll', onScroll)
      if (query.matches) {
        window.addEventListener('scroll', onScroll, { passive: true })
        measure()
      } else {
        setActive('')
      }
    }

    attach()
    query.addEventListener('change', attach)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      query.removeEventListener('change', attach)
    }
  }, [ids])

  return (
    <nav aria-label="On this page" className="mb-7 border-t-2 border-ink pt-3">
      <p className="eyebrow m-0">On this page</p>
      {/* No gap-y on touch: the links carry their own 40px height, which both
          separates them and makes them hittable. */}
      <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-4 p-0 sm:mt-2 sm:gap-y-1.5">
        {sections.map((section) => (
          <li key={section.id} className="m-0">
            <a
              href={`#${section.id}`}
              // aria-current="location" is the one that means "you are here
              // within a set of links", as opposed to page or step.
              aria-current={active === section.id ? 'location' : undefined}
              data-here={active === section.id}
              className="inline-flex min-h-10 items-center font-mono text-caption tracking-[0.1em] text-slate uppercase no-underline decoration-flame decoration-2 underline-offset-[6px] hover:text-flame hover:underline data-[here=true]:text-flame data-[here=true]:underline sm:min-h-0"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
