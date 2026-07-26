'use client'

import { useState } from 'react'

export type HeroPin = { x: number; y: number; kicker: string; note: string }

/**
 * Mise-en-place pins over the hero photo. Nothing shows until the reader asks:
 * on a mouse the dots fade in when the image is hovered; on touch a tap on the
 * image reveals them. Each dot opens its note on hover, focus, or tap. The whole
 * overlay is inert to keyboard users until they tab to a pin.
 */
export function HeroAnnotations({ items }: { items: HeroPin[] | null | undefined }) {
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  if (!items || items.length === 0) return null

  const isMouse = (t: string) => t === 'mouse' || t === 'pen'

  return (
    <div
      className="absolute inset-0 z-20"
      onPointerEnter={(e) => isMouse(e.pointerType) && setShown(true)}
      onPointerLeave={(e) => {
        if (isMouse(e.pointerType)) {
          setShown(false)
          setActive(null)
        }
      }}
    >
      {/* Reveal target for touch: a tap on the photo shows or hides the pins. */}
      <button
        type="button"
        aria-label={shown ? 'Hide the cook’s notes' : 'Show the cook’s notes'}
        aria-pressed={shown}
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
        onClick={() => setShown((s) => !s)}
      />

      {items.map((a, i) => {
        const open = active === i
        // Keep the note inside the frame: flip it to the side the dot leans away from.
        const side = a.x > 62 ? 'right' : 'left'
        const vert = a.y < 26 ? 'below' : 'above'
        return (
          <div
            key={i}
            className="pointer-events-none absolute"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
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
              onFocus={() => {
                setShown(true)
                setActive(i)
              }}
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-opacity duration-300 ${
                shown ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full bg-flame ring-4 ring-flame/25 transition-transform ${
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
  )
}
