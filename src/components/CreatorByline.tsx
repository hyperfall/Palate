'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CreatorHoverCard, type CreatorCard } from '@/components/CreatorHoverCard'

// Module-level cache so repeat hovers and multiple bylines for the same creator
// fetch the card once per page load.
const cache = new Map<string, CreatorCard>()
const inflight = new Map<string, Promise<CreatorCard | null>>()

async function loadCard(handle: string): Promise<CreatorCard | null> {
  const key = handle.toLowerCase()
  if (cache.has(key)) return cache.get(key)!
  if (inflight.has(key)) return inflight.get(key)!
  const p = fetch(`/creator/card?handle=${encodeURIComponent(key)}`)
    .then((r) => (r.ok ? (r.json() as Promise<CreatorCard>) : null))
    .then((data) => {
      if (data) cache.set(key, data)
      inflight.delete(key)
      return data
    })
    .catch(() => {
      inflight.delete(key)
      return null
    })
  inflight.set(key, p)
  return p
}

/**
 * A creator byline that reveals a mini profile card on hover (desktop) or tap
 * (touch). The card is fetched lazily the first time it opens. Accessible: the
 * trigger is a button; Esc and outside-click close it. `variant` tunes the
 * trigger text — the full "Written by …" line vs a compact "by @handle".
 */
export function CreatorByline({
  name,
  handle,
  verified = false,
  variant = 'full',
}: {
  name: string
  handle: string
  verified?: boolean
  variant?: 'full' | 'compact'
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [card, setCard] = useState<CreatorCard | null>(() => cache.get(handle.toLowerCase()) ?? null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelId = useId()

  const CARD_W = 256
  const reveal = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      // Fixed-position under the trigger, clamped to the viewport.
      const left = Math.min(Math.max(8, r.left), window.innerWidth - CARD_W - 8)
      setPos({ top: r.bottom + 6, left })
    }
    setOpen(true)
    if (!card) void loadCard(handle).then((c) => c && setCard(c))
  }
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!rootRef.current?.contains(t) && !cardRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex" onMouseEnter={reveal} onMouseLeave={scheduleClose}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : reveal())}
        onFocus={reveal}
        className="group/byline inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left"
      >
        {variant === 'full' ? (
          <span className="text-ink underline decoration-dotted decoration-slate/40 underline-offset-4 transition-colors group-hover/byline:decoration-flame">
            {name}
          </span>
        ) : (
          <span className="font-mono text-[0.75rem] tracking-[0.04em] text-slate underline decoration-dotted decoration-slate/40 underline-offset-2 transition-colors hover:text-flame">
            by @{handle}
          </span>
        )}
        {variant === 'full' && verified && (
          <span title="Verified creator" className="text-flame" aria-label="Verified creator">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.4 1.8 3-.3 1 2.8 2.6 1.4-.9 2.9.9 2.9-2.6 1.4-1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1-2.8L3 16.4l.9-2.9L3 10.6l2.6-1.4 1-2.8 3 .3z" />
              <path d="M9 12l2 2 4-4" fill="none" stroke="var(--color-paper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {variant === 'full' && <span className="font-mono text-[0.8125rem] text-slate">@{handle}</span>}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={cardRef}
            id={panelId}
            role="dialog"
            aria-label={`${name} profile`}
            className="fixed z-[70]"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={reveal}
            onMouseLeave={scheduleClose}
          >
            <CreatorHoverCard card={card} loading={!card} />
          </div>,
          document.body,
        )}
      {/* SSR/no-JS + crawlers: a plain profile link is always present for `full`. */}
      {variant === 'full' && (
        <Link href={`/creator/${handle}`} className="sr-only">
          View {name}&rsquo;s profile
        </Link>
      )}
    </span>
  )
}
