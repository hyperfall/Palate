'use client'

import { useId, useState, type ReactNode } from 'react'

/**
 * A Notion-style collapsible section: a full-width header button with a chevron
 * that rotates on open. Accessible (aria-expanded / aria-controls, keyboard-
 * operable as a native button). Presentation only — no data access.
 */
export function Disclosure({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: ReactNode
  meta?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className="border-b border-rule">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent py-3 text-left"
      >
        <span
          aria-hidden="true"
          className={`shrink-0 font-mono text-[0.8125rem] leading-none text-slate transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        {meta != null && <span className="shrink-0 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">{meta}</span>}
      </button>
      {open && (
        <div id={panelId} className="pb-3 pl-[1.4rem]">
          {children}
        </div>
      )}
    </div>
  )
}
