'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Live media-query hook — flips without a reload when the OS setting changes. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * An ambient video that rests on its own first frame and only plays while
 * hovered — the loops end where they begin, so the resting frame and the
 * playing video are the same picture (no poster swap, fully seamless).
 *
 * The economics are the point: preload="metadata" costs a few hundred KB for a
 * whole grid instead of ~13MB of autoplaying media, nothing decodes until
 * someone shows interest, and only one card plays at a time. Leaving pauses in
 * place, so re-hovering resumes rather than restarting.
 *
 * Hover is detected on the closest ancestor <a> (the whole card), with mouse/
 * pen pointers only — touch gets the poster and pays for nothing. `sound`
 * unmutes hover playback (the caller's toggle click supplies the user gesture
 * browsers require); muting always restores on leave. prefers-reduced-motion
 * renders the `fallback` still instead of a video at all.
 */
export function HoverVideo({
  src,
  className,
  ariaLabel,
  sound = false,
  autoplay = false,
  fallback = null,
}: {
  src: string
  className?: string
  ariaLabel?: string
  /** When true, hover playback is unmuted (mutes again on leave). */
  sound?: boolean
  /** When true, plays continuously (muted); hover then only governs sound. */
  autoplay?: boolean
  /** Rendered instead of the video under prefers-reduced-motion. */
  fallback?: ReactNode
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound
  const autoplayRef = useRef(autoplay)
  autoplayRef.current = autoplay
  const reduced = usePrefersReducedMotion()

  // Armed/disarmed from the toggle — a click gesture, so play() is reliable.
  useEffect(() => {
    const v = ref.current
    if (!v || reduced) return
    if (autoplay) {
      v.muted = true
      void v.play().catch(() => {})
    } else {
      v.pause()
      v.muted = true
    }
  }, [autoplay, reduced])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const host: Element = v.closest('a') ?? v.parentElement ?? v

    const enter = (e: Event) => {
      const pt = (e as PointerEvent).pointerType
      if (pt && pt !== 'mouse' && pt !== 'pen') return
      v.muted = !soundRef.current
      void v.play().catch(() => {
        // Unmuted play refused (no valid gesture yet) — degrade to muted motion.
        v.muted = true
        void v.play().catch(() => {})
      })
    }
    const leave = () => {
      v.muted = true
      // Under autoplay the card keeps moving after the cursor leaves — hover
      // only governed the sound.
      if (!autoplayRef.current) v.pause()
    }

    host.addEventListener('pointerenter', enter)
    host.addEventListener('pointerleave', leave)
    return () => {
      host.removeEventListener('pointerenter', enter)
      host.removeEventListener('pointerleave', leave)
    }
  }, [reduced])

  if (reduced) return <>{fallback}</>

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      // The resting state IS the video's first frame — the loops end where they
      // begin, so hover playback continues from exactly what's on screen with
      // no poster swap. The tiny seek forces browsers (Safari especially) to
      // actually paint frame one under preload="metadata".
      onLoadedMetadata={(e) => {
        try {
          e.currentTarget.currentTime = 0.001
        } catch {
          /* leave the element to paint when it can */
        }
      }}
      aria-label={ariaLabel}
      className={className}
    />
  )
}
