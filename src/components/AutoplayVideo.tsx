'use client'

import { useEffect, useState, type ReactNode, type RefObject } from 'react'

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
 * A muted, looping, autoplaying ambient video that actually autoplays.
 *
 * The battle scars live here so every surface shares them:
 * - React doesn't serialize `muted` into SSR HTML, so the browser parses
 *   <video autoplay> without it and refuses unmuted autoplay — kick play()
 *   ourselves on mount.
 * - Hydration re-loads the src and aborts any in-flight play() (AbortError);
 *   a swallowed rejection means a permanently frozen frame — retry on
 *   loadedmetadata and canplay, which refire after every load.
 * - preload="auto", or a metadata-only element deadlocks: no buffering
 *   without a play request, no canplay without buffering.
 * - prefers-reduced-motion renders the `fallback` (usually the still image)
 *   instead of the video entirely.
 */
export function AutoplayVideo({
  src,
  poster,
  className,
  ariaLabel,
  videoRef,
  fallback = null,
}: {
  src: string
  poster?: string
  className?: string
  ariaLabel?: string
  /** For callers that need the element (e.g. hover-to-unmute). */
  videoRef?: RefObject<HTMLVideoElement | null>
  /** Rendered instead of the video under prefers-reduced-motion. */
  fallback?: ReactNode
}) {
  const reduced = usePrefersReducedMotion()

  const ensurePlaying = () => {
    const v = videoRef?.current ?? internalRef
    if (v && v.paused) {
      void v.play().catch(() => {})
    }
  }
  let internalRef: HTMLVideoElement | null = null

  useEffect(() => {
    if (!reduced) ensurePlaying()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + mode flip only
  }, [reduced])

  if (reduced) return <>{fallback}</>

  return (
    <video
      ref={(el) => {
        internalRef = el
        if (videoRef) videoRef.current = el
        if (el) {
          el.muted = true
          if (el.paused) void el.play().catch(() => {})
        }
      }}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onLoadedMetadata={ensurePlaying}
      onCanPlay={ensurePlaying}
      aria-label={ariaLabel}
      className={className}
    />
  )
}
