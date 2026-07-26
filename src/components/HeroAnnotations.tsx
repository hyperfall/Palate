'use client'

import { useLayoutEffect, useRef, useState } from 'react'

export type HeroPin = { x: number; y: number; kicker: string; note: string }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/**
 * Mise-en-place pins over the hero photo. Nothing shows until the reader asks:
 * on a mouse the dots fade in when the hero is hovered (group-hover); on touch a
 * tap on the photo reveals them. Each dot opens its note on hover, focus, or tap.
 *
 * Placement is smart, not static: the authored x/y is a starting wish, but the
 * oversized title owns the lower-left and its footprint moves with the viewport
 * and title length. So on mount and on every resize we measure the title block
 * ([data-hero-type]) and nudge any pin that lands in it out to the nearest free
 * space — lifted above the title, else to its side — always clamped inside the
 * frame so a dot is never out of sight.
 *
 * Layering: the reveal tap-target sits below the title (z-10) so it never covers
 * the controls; the pins and notes sit above it (z-40) so an open note is a
 * legible card on top of the type. Requires `group/hero` on the <header>.
 */
export function HeroAnnotations({ items }: { items: HeroPin[] | null | undefined }) {
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Array<{ x: number; y: number }>>(() =>
    (items ?? []).map((p) => ({ x: clamp(p.x, 5, 95), y: clamp(p.y, 5, 95) })),
  )

  useLayoutEffect(() => {
    if (!items || items.length === 0) return
    const header = wrapRef.current?.closest('header') as HTMLElement | null
    if (!header) return

    const PAD = 5 // never within 5% of an edge
    const MX = 3 // clearance around the title, x
    const MY = 4 // clearance around the title, y

    const compute = () => {
      const hr = header.getBoundingClientRect()
      if (!hr.width || !hr.height) return
      const typeEl = header.querySelector('[data-hero-type]') as HTMLElement | null
      const ko = typeEl
        ? (() => {
            const t = typeEl.getBoundingClientRect()
            return {
              x0: ((t.left - hr.left) / hr.width) * 100,
              y0: ((t.top - hr.top) / hr.height) * 100,
              x1: ((t.right - hr.left) / hr.width) * 100,
              y1: ((t.bottom - hr.top) / hr.height) * 100,
            }
          })()
        : null

      setPos(
        items.map((p) => {
          let x = clamp(p.x, PAD, 100 - PAD)
          let y = clamp(p.y, PAD, 100 - PAD)
          if (ko && x >= ko.x0 - MX && x <= ko.x1 + MX && y >= ko.y0 - MY && y <= ko.y1 + MY) {
            // The title lives bottom-left, so above and to-the-right are the open
            // areas. Exit toward whichever is nearer; fall back to the top strip
            // if the title fills the frame (narrow viewports).
            const upY = ko.y0 - MY
            const rX = ko.x1 + MX
            const canUp = upY >= PAD
            const canRight = rX <= 100 - PAD
            if (canUp && canRight) {
              if (y - upY <= rX - x) y = upY
              else x = rX
            } else if (canRight) {
              x = rX
            } else if (canUp) {
              y = upY
            } else {
              y = PAD
            }
          }
          return { x, y }
        }),
      )
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(header)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [items])

  if (!items || items.length === 0) return null
  const isMouse = (t: string) => t === 'mouse' || t === 'pen'

  return (
    <>
      {/* Touch reveal: a tap on the photo shows or hides the pins. Below the type
          block, so taps on the controls still reach them. */}
      <button
        type="button"
        aria-label={shown ? 'Hide the cook’s notes' : 'Show the cook’s notes'}
        aria-pressed={shown}
        className="absolute inset-0 z-10 h-full w-full cursor-default bg-transparent"
        onClick={() => setShown((s) => !s)}
      />

      <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-40">
        {items.map((a, i) => {
          const open = active === i
          const p = pos[i] ?? { x: clamp(a.x, 5, 95), y: clamp(a.y, 5, 95) }
          const side = p.x > 62 ? 'right' : 'left'
          const vert = p.y < 26 ? 'below' : 'above'
          return (
            <div
              key={i}
              className="absolute transition-[left,top] duration-300 ease-out"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <button
                type="button"
                aria-label={`${a.kicker}: ${a.note}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setShown(true)
                  setActive(open ? null : i)
                }}
                onPointerEnter={(e) => isMouse(e.pointerType) && setActive(i)}
                onPointerLeave={(e) => isMouse(e.pointerType) && setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-opacity duration-300 ${
                  shown
                    ? 'pointer-events-auto opacity-100'
                    : 'pointer-events-none opacity-0 group-hover/hero:pointer-events-auto group-hover/hero:opacity-100'
                }`}
              >
                <span
                  className={`block h-2.5 w-2.5 rounded-full bg-flame transition-transform duration-200 ${
                    open ? 'scale-150' : ''
                  }`}
                  style={{
                    boxShadow: '0 0 5px 1px rgba(228,87,46,0.7), 0 0 13px 4px rgba(228,87,46,0.35)',
                  }}
                />
              </button>

              <span
                role="tooltip"
                className={`pointer-events-none absolute z-10 w-max max-w-[13rem] rounded-md bg-card px-2.5 py-1.5 text-left shadow-block ring-1 ring-ink/10 transition-all duration-200 ${
                  open ? 'opacity-100' : 'translate-y-0.5 opacity-0'
                } ${vert === 'above' ? 'bottom-3 mb-1' : 'top-3 mt-1'} ${
                  side === 'right' ? 'right-1 items-end text-right' : 'left-1'
                }`}
              >
                <span className="block font-mono text-[0.5625rem] tracking-[0.12em] text-flame uppercase">
                  {a.kicker}
                </span>
                <span className="block font-display text-[0.9375rem] leading-tight text-ink">{a.note}</span>
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
