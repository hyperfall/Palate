'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

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
  // 'light' | 'dark' core per pin, chosen from the pixels beneath it.
  const [tones, setTones] = useState<Array<'light' | 'dark'>>([])

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

  // Sample the hero pixels under each (adjusted) pin and pick a light or dark
  // core so the dot stays legible on a busy photo — a flame dot vanishes on a
  // red sauce. Re-runs when pins move (resize) or the image finishes loading.
  useEffect(() => {
    if (!items || items.length === 0) return
    const header = wrapRef.current?.closest('header') as HTMLElement | null
    const img = header?.querySelector('img') as HTMLImageElement | null
    if (!header || !img) return

    const sample = () => {
      if (!img.complete || !img.naturalWidth) return
      const hr = header.getBoundingClientRect()
      if (!hr.width || !hr.height) return
      const cw = 120
      const ch = Math.max(1, Math.round((120 * hr.height) / hr.width))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      // Replicate object-fit: cover with the image's focal point so canvas
      // coordinates line up with what's actually on screen.
      const op = getComputedStyle(img).objectPosition.split(' ')
      const fx = (parseFloat(op[0]) || 50) / 100
      const fy = (parseFloat(op[1] ?? op[0]) || 50) / 100
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      try {
        ctx.drawImage(img, (cw - dw) * fx, (ch - dh) * fy, dw, dh)
        const d = ctx.getImageData(0, 0, cw, ch).data
        const lumAt = (xp: number, yp: number) => {
          const px = clamp(Math.round((xp / 100) * cw), 0, cw - 1)
          const py = clamp(Math.round((yp / 100) * ch), 0, ch - 1)
          let r = 0
          let g = 0
          let b = 0
          let n = 0
          for (let a = -1; a <= 1; a++) {
            for (let c = -1; c <= 1; c++) {
              const xx = clamp(px + a, 0, cw - 1)
              const yy = clamp(py + c, 0, ch - 1)
              const i = (yy * cw + xx) * 4
              r += d[i]
              g += d[i + 1]
              b += d[i + 2]
              n += 1
            }
          }
          return (0.2126 * r + 0.7152 * g + 0.0722 * b) / n
        }
        setTones(pos.map((p) => (lumAt(p.x, p.y) < 140 ? 'light' : 'dark')))
      } catch {
        // Cross-origin taint or draw failure — keep the default tone.
      }
    }

    if (img.complete) sample()
    else {
      img.addEventListener('load', sample)
      return () => img.removeEventListener('load', sample)
    }
  }, [items, pos])

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
                    // Flame stays the core; only the halo adapts — a light rim on
                    // dark pixels, a dark rim on light ones — so it reads anywhere.
                    boxShadow:
                      (tones[i] ?? 'light') === 'light'
                        ? '0 0 0 1.5px rgba(255,255,255,0.9), 0 0 11px 3px rgba(228,87,46,0.5)'
                        : '0 0 0 1.5px rgba(20,16,12,0.55), 0 0 10px 3px rgba(228,87,46,0.45)',
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
