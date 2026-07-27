'use client'

import Image from 'next/image'
import Link from 'next/link'

import { HoverVideo, usePrefersReducedMotion } from '@/components/HoverVideo'
import { useState } from 'react'

export type CuisineCardData = {
  slug: string
  name: string
  flagEmoji?: string | null
  description?: string | null
  count: number
  imageUrl: string | null
  imageAlt: string
  /** Auto-detected from media/animated/<slug>.mp4 — null falls back to the image. */
  videoUrl: string | null
}

/**
 * The cuisines grid. Cards with an animation autoplay it muted and looping,
 * with the hero image as poster/fallback; cards without one render the image
 * exactly as before.
 *
 * Sound is opt-in and hover-scoped: a toggle (off on every visit — surprise
 * audio is hostile) arms it, and only the card under the cursor is unmuted.
 * The toggle's click is the user gesture that lets browsers allow the unmute.
 * On touch devices there is no hover, so the toggle hides itself entirely.
 */
export function CuisineCards({ items }: { items: CuisineCardData[] }) {
  const [sound, setSound] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const hasVideos = !reducedMotion && items.some((c) => c.videoUrl)

  return (
    <>
      {hasVideos && (
        <div className="mt-6 hidden justify-end [@media(hover:hover)]:flex">
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => setSound((s) => !s)}
            className={`chip ${sound ? '' : 'text-slate'}`}
            title={sound ? 'Hovered cards play with sound' : 'Hovered cards play silently'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6.5 8.5H3v7h3.5L11 19z" />
              {sound ? (
                <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
              ) : (
                <path d="m15.5 9.5 5 5m0-5-5 5" />
              )}
            </svg>
            {sound ? 'Sound on hover' : 'Sound off'}
          </button>
        </div>
      )}

      <div className={`${hasVideos ? 'mt-4' : 'mt-8'} grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3 min-[100rem]:grid-cols-4`}>
        {items.map((cuisine) => (
          <CuisineCard
            key={cuisine.slug}
            cuisine={reducedMotion ? { ...cuisine, videoUrl: null } : cuisine}
            sound={sound}
          />
        ))}
      </div>
    </>
  )
}

function CuisineCard({ cuisine, sound }: { cuisine: CuisineCardData; sound: boolean }) {
  const still = cuisine.imageUrl ? (
    <Image
      src={cuisine.imageUrl}
      alt={cuisine.imageAlt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
    />
  ) : null

  return (
    <Link href={`/cuisine/${cuisine.slug}`} className="ticket-card group block no-underline">
      <div className="relative aspect-[16/9] overflow-hidden bg-wash">
        {cuisine.videoUrl ? (
          <HoverVideo
            src={cuisine.videoUrl}
            sound={sound}
            ariaLabel={`${cuisine.name} cuisine animation`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            fallback={still}
          />
        ) : (
          still
        )}
      </div>
      {/* Ambient text panel — the same trick as the recipe hero's blur-up: the
          scene's poster frame, blurred into a wash behind the copy, under a
          translucent layer of the card colour so ink/slate text keeps its
          contrast in both themes. Each card glows in its own palette. */}
      <div className="relative overflow-hidden">
        {cuisine.imageUrl && (
          <>
            <div
              aria-hidden="true"
              className="absolute -inset-6 scale-110 bg-cover bg-center blur-xl"
              style={{ backgroundImage: `url(${cuisine.imageUrl})` }}
            />
            <div aria-hidden="true" className="absolute inset-0 bg-card/85" />
          </>
        )}
        <div className="relative p-5">
          <div className="leader">
            <h2 className="text-[1.25rem] text-ink group-hover:underline">
              {cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}
              {cuisine.name}
            </h2>
            <span className="leader__dots" aria-hidden="true" />
            <span className="eyebrow shrink-0">
              {cuisine.count} {cuisine.count === 1 ? 'recipe' : 'recipes'}
            </span>
          </div>
          {cuisine.description && (
            <p className="mt-2 max-w-[46ch] text-[0.9375rem] leading-snug text-slate">
              {cuisine.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
