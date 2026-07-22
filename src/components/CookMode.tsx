'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { CookStep } from '@/lib/stepIngredients'
import { SubstitutionPopover } from './SubstitutionPopover'

type Finish = {
  storageDays?: number | null
  reheat?: string | null
  leftoverIdeas?: string | null
} | null

/**
 * Failure recovery — the roadmap's "fix it" playbook. Curated, terse, and
 * honest (sometimes the fix is to start the garlic again). Reachable from the
 * cook-mode rail at the exact moment things go sideways.
 */
const RESCUES: Array<{ problem: string; fix: string }> = [
  {
    problem: 'Too salty',
    fix: 'Add acid (lemon, vinegar) and something starchy or fatty — potato, unsalted stock, cream, coconut milk. Dilution beats regret; never try to “cook it off”.',
  },
  {
    problem: 'Sauce split',
    fix: 'Off the heat, whisk in a splash of cold water or liquid a spoon at a time. Butter or cream sauces: re-emulsify over the lowest heat while whisking — never boil.',
  },
  {
    problem: 'Rice undercooked',
    fix: 'Splash over boiling water, lid on, lowest heat, 5 minutes, then rest for 5. Do not stir it while it steams.',
  },
  {
    problem: 'Too spicy',
    fix: 'Dairy or coconut milk absorbs heat; a pinch of sugar and a squeeze of acid rebalance it. Serve with plain rice or bread and warn the table.',
  },
  {
    problem: 'Burnt garlic',
    fix: 'Start it again — fresh oil, fresh garlic, thirty seconds. Burnt garlic is bitter and nothing masks it. This is the cheapest fix in the kitchen.',
  },
  {
    problem: 'Sauce too thin',
    fix: 'Simmer uncovered on high to reduce, or whisk in a cornflour slurry (1 tsp cornflour + 1 tbsp cold water) and cook one more minute.',
  },
  {
    problem: 'Stuck to the pan',
    fix: 'Deglaze: add liquid to the hot pan and scrape with a wooden spoon. That browned layer is flavour, not failure — unless it is black, in which case leave it.',
  },
]

/**
 * Cooking mode — the recipe made executable. Full-screen, one step at a time,
 * type sized for a counter's-length glance, and controls big enough for
 * knuckles. The screen stays awake (Wake Lock, re-acquired when the tab
 * returns), steps with a duration get their own timer with an audible chime,
 * and arrow keys / on-screen buttons move through the method.
 */
export function CookMode({
  title,
  steps,
  finish = null,
  onClose,
}: {
  title: string
  steps: CookStep[]
  finish?: Finish
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [rescueOpen, setRescueOpen] = useState(false)
  const done = index >= steps.length
  const step = done ? null : steps[index]

  // --- Wake lock -----------------------------------------------------------
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
        }
        if (nav.wakeLock && !cancelled) lock = await nav.wakeLock.request('screen')
      } catch {
        // Battery saver or unsupported browser — cooking continues regardless.
      }
    }

    void acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [])

  // --- Scroll lock + keyboard ---------------------------------------------
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // --- Focus management -----------------------------------------------------
  // This dialog replaces the whole screen, so a keyboard or screen-reader user
  // needs focus moved onto it on open, and back to whatever launched it on
  // close — otherwise focus is left stranded on a button now hidden behind it.
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => {
      previouslyFocused?.focus?.()
    }
  }, [])

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, steps.length)), [steps.length])
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') next()
      else if (event.key === 'ArrowLeft') back()
      else if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, onClose])

  // --- Per-step timer ------------------------------------------------------
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  // Closes the chime's AudioContext on unmount — otherwise repeatedly
  // opening/closing cooking mode across a session leaks one per timer used.
  useEffect(() => {
    return () => {
      void audioRef.current?.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    setSecondsLeft(step?.timerSeconds ?? null)
    setRunning(false)
  }, [index, step?.timerSeconds])

  useEffect(() => {
    if (!running || secondsLeft === null) return
    if (secondsLeft <= 0) {
      setRunning(false)
      chime()
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000)
    return () => clearTimeout(t)
     
  }, [running, secondsLeft])

  // Function declaration so the countdown effect above can reach it (hoisted).
  function chime() {
    try {
      audioRef.current ??= new AudioContext()
      const ctx = audioRef.current
      for (const delay of [0, 0.35, 0.7]) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.001, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + delay + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3)
        osc.connect(gain).connect(ctx.destination)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.32)
      }
    } catch {
      // No audio — the visual 0:00 still lands.
    }
  }

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${title}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-paper text-ink outline-none"
    >
      {/* Rail: where you are, and the way out. */}
      <div className="flex items-center justify-between gap-4 border-b-2 border-ink px-5 py-4 sm:px-8">
        <p className="eyebrow m-0 truncate text-ink">{title}</p>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setRescueOpen((v) => !v)}
            className="chip"
            data-active={rescueOpen}
          >
            Fix it
          </button>
          {!done && (
            <span className="font-mono text-[0.8125rem] font-semibold tracking-[0.1em] tabular-nums">
              STEP {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit cooking mode"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-base text-ink hover:border-ink"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress strip. */}
      <div aria-hidden="true" className="h-1 bg-wash">
        <div
          className="h-full bg-flame transition-[width] duration-300"
          style={{ width: `${(Math.min(index, steps.length) / steps.length) * 100}%` }}
        />
      </div>

      {/* The step, at counter distance — or the rescue playbook when open. */}
      <div className="scroll-rail flex flex-1 items-center overflow-y-auto">
        <div className="shell max-w-[52rem] py-10">
          {rescueOpen ? (
            <div>
              <p className="eyebrow m-0 text-flame">Fix it</p>
              <dl className="m-0 mt-5 grid gap-5">
                {RESCUES.map((rescue) => (
                  <div key={rescue.problem} className="border-t border-rule pt-4">
                    <dt className="font-mono text-[1rem] font-semibold tracking-[0.06em] uppercase">
                      {rescue.problem}
                    </dt>
                    <dd className="m-0 mt-1.5 max-w-[62ch] text-[1.0625rem] leading-relaxed text-slate">
                      {rescue.fix}
                    </dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => setRescueOpen(false)}
                className="btn-primary mt-8"
              >
                Back to the step
              </button>
            </div>
          ) : done ? (
            <div>
              <p className="eyebrow m-0 text-flame">End of service</p>
              <p className="mt-4 font-display text-[clamp(1.75rem,4vw,3rem)] leading-tight">
                Plates up. Taste once more before it leaves the pass.
              </p>
              {finish?.storageDays || finish?.reheat || finish?.leftoverIdeas ? (
                <dl className="m-0 mt-6 grid max-w-[34rem] gap-2.5">
                  {finish.storageDays ? (
                    <div className="leader">
                      <dt className="eyebrow">Keeps</dt>
                      <span className="leader__dots" aria-hidden="true" />
                      <dd className="datum m-0">
                        {finish.storageDays} {finish.storageDays === 1 ? 'day' : 'days'} chilled
                      </dd>
                    </div>
                  ) : null}
                  {finish.reheat ? (
                    <div className="leader">
                      <dt className="eyebrow">Reheat</dt>
                      <span className="leader__dots" aria-hidden="true" />
                      <dd className="datum m-0 text-right">{finish.reheat}</dd>
                    </div>
                  ) : null}
                  {finish.leftoverIdeas ? (
                    <div className="leader">
                      <dt className="eyebrow">Tomorrow</dt>
                      <span className="leader__dots" aria-hidden="true" />
                      <dd className="datum m-0 text-right">{finish.leftoverIdeas}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-5 max-w-[44ch] text-slate">
                  Leftovers keep best cooled fast and boxed shallow. Reheat gently — most dishes
                  want less heat the second time, not more.
                </p>
              )}
            </div>
          ) : (
            <div>
              <span className="font-mono text-[1.125rem] font-semibold text-flame tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="mt-3 font-body text-[clamp(1.375rem,3vw,2.125rem)] leading-snug font-medium">
                {step?.text}
              </p>

              {step && step.uses.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="eyebrow text-slate">You'll need</span>
                  {step.uses.map((use) =>
                    use.substitutions && use.substitutions.length > 0 ? (
                      <span key={use.name} className="chip !cursor-auto !py-1">
                        <SubstitutionPopover item={use.name} substitutions={use.substitutions} />
                      </span>
                    ) : (
                      <span key={use.name} className="chip !min-h-0 !cursor-default !py-1">
                        {use.name}
                      </span>
                    ),
                  )}
                </div>
              )}
              {step && step.prepAhead.length > 0 && (
                <p className="mt-4 font-mono text-[0.8125rem] text-flame">
                  Coming up — take out: {step.prepAhead.join(', ')}.
                </p>
              )}

              {step?.timerSeconds ? (
                <div className="mt-8 flex items-center gap-4">
                  <span
                    aria-live="polite"
                    className={`font-mono text-[2rem] font-semibold tabular-nums ${
                      secondsLeft === 0 ? 'text-flame' : ''
                    }`}
                  >
                    {mmss(secondsLeft ?? step.timerSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRunning((r) => !r)}
                    className="chip"
                    data-active={running}
                  >
                    {running ? 'Pause' : secondsLeft === step.timerSeconds ? 'Start timer' : 'Resume'}
                  </button>
                  {secondsLeft !== step.timerSeconds && (
                    <button
                      type="button"
                      onClick={() => {
                        setSecondsLeft(step.timerSeconds ?? null)
                        setRunning(false)
                      }}
                      className="chip"
                    >
                      Reset
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Knuckle-sized controls. */}
      <div className="border-t border-rule">
        <div className="shell flex items-center justify-between gap-4 py-4">
          <button
            type="button"
            onClick={back}
            disabled={index === 0}
            className="chip !min-h-[3rem] !px-6 disabled:cursor-default disabled:opacity-40"
          >
            ← Back
          </button>
          {done ? (
            <button type="button" onClick={onClose} className="btn-primary">
              Finish
            </button>
          ) : (
            <button type="button" onClick={next} className="btn-primary !min-h-[3rem]">
              {index === steps.length - 1 ? 'Done →' : 'Next step →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** The hero CTA: opens cooking mode, with a quiet fallback to read the method. */
export function CookModeLauncher({
  title,
  steps,
  finish = null,
}: {
  title: string
  steps: CookStep[]
  finish?: Finish
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !py-2.5">
        Start cooking
      </button>
      <a
        href="#method"
        className="font-mono text-[0.8125rem] font-medium tracking-[0.12em] text-milk/80 uppercase underline underline-offset-4 hover:text-flame"
      >
        Read it first ↓
      </a>
      {open && <CookMode title={title} steps={steps} finish={finish} onClose={() => setOpen(false)} />}
    </>
  )
}
