'use client'

import { useState } from 'react'

export type HeroPin = { x: number; y: number; kicker: string; note: string }

/**
 * Mise-en-place pins over the hero photo. Nothing shows until the reader asks:
 * on a mouse the dots fade in when the hero is hovered (group-hover); on touch a
 * tap on the photo reveals them. Each dot opens its note on hover, focus, or tap.
 *
 * Layering matters: the reveal tap-target sits *below* the title (z-10) so it
 * never covers the controls, while the pins and their notes sit *above* it
 * (z-40) so an open note is a legible card on top of the oversized type, never
 * trapped behind it. Requires `group/hero` on the <header>.
 */
export function HeroAnnotations({ items }: { items: HeroPin[] | null | undefined }) {
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState<number | null>(null)
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

      <div className="pointer-events-none absolute inset-0 z-40">
        {items.map((a, i) => {
          const open = active === i
          const side = a.x > 62 ? 'right' : 'left'
          const vert = a.y < 26 ? 'below' : 'above'
          return (
            <div key={i} className="absolute" style={{ left: `${a.x}%`, top: `${a.y}%` }}>
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
                  className={`grid h-4 w-4 place-items-center rounded-full bg-flame shadow-[0_0_0_2px_rgba(255,255,255,0.85)] ring-4 ring-flame/25 transition-transform ${
                    open ? 'scale-110' : ''
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-on-flame" />
                </span>
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
