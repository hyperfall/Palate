'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useDialogFocus } from '@/lib/useDialogFocus'
import { TasteNight } from './TasteNight'

type QuizDish = { title: string; image: string | null; cuisine: string | null; totalLabel: string }

// Don't nudge where it'd be redundant or intrusive (the quiz itself, onboarding,
// account/studio flows, a shared page a guest landed on).
const SUPPRESS = ['/taste-night', '/taste', '/account', '/studio', '/plan/shared']
const KEY = 'palate:quiz-nudge'
const SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * A quiet, witty nudge toward Taste Night — slides up bottom-right a beat after
 * you land, dismissable (and then it stays gone for a week). Clicking opens the
 * quiz in a modal so you never lose your place; it lazy-loads its dishes.
 */
export function QuizNudge() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [shown, setShown] = useState(false) // drives the slide-in transition
  const [open, setOpen] = useState(false)
  const [dishes, setDishes] = useState<QuizDish[] | null>(null)

  useEffect(() => {
    if (!pathname || SUPPRESS.some((r) => pathname.startsWith(r))) return
    try {
      const raw = localStorage.getItem(KEY)
      if (raw && Date.now() - Number(raw) < SUPPRESS_MS) return
    } catch {
      // storage blocked — just show it
    }
    const t = setTimeout(() => setVisible(true), 10000 + Math.random() * 8000)
    return () => clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    if (visible) requestAnimationFrame(() => setShown(true))
  }, [visible])

  // Focus in, trap Tab, Escape out. It appears unprompted on almost every
  // page, so it must never strand a keyboard user behind its overlay.
  const quizRef = useRef<HTMLDivElement>(null)
  const closeQuiz = useCallback(() => setOpen(false), [])
  useDialogFocus({ open, ref: quizRef, onClose: closeQuiz })

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  const openQuiz = async () => {
    dismiss()
    setOpen(true)
    if (!dishes) {
      try {
        const res = await fetch('/taste-night/dishes')
        const data = (await res.json()) as { dishes?: QuizDish[] }
        setDishes(data.dishes ?? [])
      } catch {
        setDishes([])
      }
    }
  }

  return (
    <>
      {visible && !open && (
        <div
          className={`fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 w-[19rem] max-w-[calc(100vw-2rem)] rounded-lg border border-rule bg-card p-4 shadow-(--shadow-block) transition-all duration-300 sm:bottom-5 ${
            shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          }`}
          role="dialog"
          aria-label="Take the quiz"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-2 right-2 grid h-6 w-6 cursor-pointer place-items-center rounded border-none bg-transparent font-mono text-slate hover:text-heat"
          >
            ✕
          </button>
          <p className="eyebrow m-0 text-flame">Quiz night at the pass</p>
          <h3 className="mt-1 text-title leading-tight text-ink">Think you know your onions?</h3>
          <p className="mt-1.5 text-eyebrow leading-snug text-slate">
            Eight quick questions, two minutes — and the dish your palate’s been after.
          </p>
          <button type="button" onClick={() => void openQuiz()} className="btn-primary mt-3 !py-2 !text-detail">
            Take Taste Night →
          </button>
        </div>
      )}

      {open && (
        <div
          ref={quizRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Taste Night"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pan-deep/70 p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="relative my-auto w-full max-w-[52rem] rounded-lg border border-rule bg-paper px-6 pt-14 pb-6 shadow-(--shadow-block) sm:px-10 sm:pb-10">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close quiz"
              className="absolute top-4 right-4 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded border border-rule bg-paper font-mono text-ink hover:border-heat hover:text-heat"
            >
              ✕
            </button>
            {dishes === null ? (
              <p className="py-20 text-center font-mono text-slate">Setting up the round…</p>
            ) : (
              <TasteNight dishes={dishes} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
