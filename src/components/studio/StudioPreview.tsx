'use client'

import { VideoEmbed } from '@/components/VideoEmbed'

/**
 * The studio's live preview — a faithful mock of how the recipe will publish,
 * shown docked beside the form at xl and as a modal below it.
 *
 * Pulled out of StudioForm because it is the one large block that only READS
 * the form: it holds no state of its own beyond the open flag the form owns, so
 * it takes the already-derived values as props and renders them. Keeping it here
 * keeps StudioForm's length about the form's behaviour, not its mirror.
 */

type PreviewIngredient = { item: string; measure: string; heading: boolean }
type PreviewStep = { text: string; imageUrl: string | null }
type PreviewProfile = { name: string | null; username: string | null; verified: boolean }

export function StudioPreview({
  open,
  onOpen,
  onClose,
  photoUrl,
  title,
  facts,
  profile,
  ingredients,
  steps,
  videoPreview,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  photoUrl: string | null
  title: string
  facts: string[]
  profile: PreviewProfile
  ingredients: PreviewIngredient[]
  steps: PreviewStep[]
  videoPreview: string
}) {
  return (
    <>
    {/* Live preview — docked and sticky beside the form at xl, where the page
        has free width; below xl the pill opens the same card as a modal at
        card width, never a viewport takeover. Backdrop click and Escape close. */}
    <aside
      aria-label="Recipe preview"
      role={open ? 'dialog' : undefined}
      aria-modal={open ? true : undefined}
      className={
        open
          ? 'fixed inset-0 z-50 grid place-items-center p-4 sm:p-8'
          : 'hidden min-w-0 xl:sticky xl:top-24 xl:block'
      }
    >
      {open && (
        <button
          type="button"
          aria-label="Close preview"
          onClick={() => onClose()}
          className="absolute inset-0 cursor-default border-none bg-ink/45 backdrop-blur-[2px]"
        />
      )}
      <div
        className={
          open
            ? 'relative max-h-full w-full max-w-[26rem] overflow-y-auto rounded-lg bg-paper p-4 shadow-2xl'
            : undefined
        }
      >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow m-0">Live preview — how it will look</p>
        {open && (
          <button
            type="button"
            onClick={() => onClose()}
            aria-label="Close preview"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-ink hover:border-heat hover:text-heat"
          >
            ✕
          </button>
        )}
      </div>
      <div className="ticket-card is-static mt-3 overflow-hidden">
        <div className="relative bg-pan text-milk">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={photoUrl} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center bg-pan-deep">
              <span className="rounded-sm border border-dashed border-milk/25 px-4 py-2 font-mono text-[0.75rem] tracking-[0.06em] text-milk/50 uppercase">
                your photo lands here
              </span>
            </div>
          )}
          {/* Mirrors the published hero: photo at full colour, a wash only across
              the lower third, flame rule, oversized serif title, spec line under. */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-pan-deep/90 via-pan-deep/25 to-transparent p-5">
            <span className="mb-2 block h-[2px] w-8 bg-flame" aria-hidden="true" />
            <h3 className="font-display text-[2rem] leading-[0.95] tracking-[-0.01em] text-milk">
              {title || 'Your recipe title'}
            </h3>
            <p className="mt-2 m-0 font-mono text-[0.75rem] tracking-[0.02em] text-milk">
              {facts.join(' · ')}
            </p>
          </div>
        </div>

        {/* Byline — matches the published recipe page exactly (plain "Written by",
            no avatar), so the preview never promises a treatment that won't ship. */}
        <div className="border-b border-rule p-4">
          <p className="m-0 flex flex-wrap items-center gap-1.5 text-[0.9375rem] leading-snug text-slate">
            Written by <span className="font-semibold text-ink">{profile.name ?? 'Your name'}</span>
            {profile.verified && (
              <span title="Verified creator" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-flame text-[0.625rem] text-paper">✓</span>
            )}
            {profile.username && (
              <span className="font-mono text-[0.75rem] text-slate">@{profile.username}</span>
            )}
          </p>
        </div>

        <div className="grid gap-5 p-4">
          <div>
            <p className="eyebrow m-0">Ingredients</p>
            <ul className="m-0 mt-2 list-none space-y-2 p-0">
              {(ingredients.length
                ? ingredients
                : [{ item: 'something delicious', measure: '2 tbsp', heading: false }]
              )
                .slice(0, 8)
                .map((row, i) =>
                  row.heading ? (
                    <li key={i} className="eyebrow pt-2 text-ink first:pt-0">
                      {row.item}
                    </li>
                  ) : (
                    <li key={i} className="leader text-[0.9375rem] leading-snug">
                      <span className="break-words [overflow-wrap:anywhere]">{row.item}</span>
                      {/* The dotted leader promises a measure — only draw it when
                          one is coming, exactly as the recipe page does. */}
                      {row.measure ? (
                        <>
                          <span className="leader__dots" aria-hidden="true" />
                          <span className="datum shrink-0">{row.measure}</span>
                        </>
                      ) : null}
                    </li>
                  ),
                )}
              {ingredients.length > 8 && (
                <li className="pt-1 font-mono text-[0.75rem] text-slate">+ {ingredients.length - 8} more</li>
              )}
            </ul>
          </div>
          <div>
            <p className="eyebrow m-0">Method</p>
            <ol className="m-0 mt-2 list-none space-y-3 p-0">
              {(steps.length
                ? steps
                : [{ text: 'Steps appear here as you write them.', imageUrl: null }]
              )
                .slice(0, 4)
                .map((step, i) => (
                  <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 gap-y-2">
                    <span className="font-mono text-[0.9375rem] font-bold text-flame tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="m-0 text-[0.9375rem] leading-relaxed break-words [overflow-wrap:anywhere]">
                      {step.text.trim()}
                    </p>
                    {step.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- local preview
                      <img
                        src={step.imageUrl}
                        alt=""
                        className="col-start-2 w-full rounded border border-rule object-cover"
                      />
                    )}
                  </li>
                ))}
              {steps.length > 4 && (
                <li className="font-mono text-[0.75rem] text-slate">+ {steps.length - 4} more steps</li>
              )}
            </ol>
          </div>

          {/* The creator's video, embedded exactly as viewers will see it —
              a recognised link becomes a player, anything else a Watch link. */}
          {videoPreview && (
            <div>
              <p className="eyebrow m-0">Watch</p>
              <div className="mt-2">
                <VideoEmbed url={videoPreview} title="Recipe video preview" />
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </aside>

      {/* Small screens only: a floating trigger opens the preview overlay, so it
          stays out of the way until the creator wants to check their work. */}
      {!open && (
        <button
          type="button"
          onClick={() => onOpen()}
          aria-haspopup="dialog"
          // Clear the fixed bottom nav on phones (it's ~3.25rem tall, sm:hidden);
          // on tablets there's no bottom bar, so sit closer to the edge.
          className="fixed right-5 bottom-[calc(3.25rem+env(safe-area-inset-bottom)+1rem)] z-40 flex items-center gap-2 rounded-full border border-flame bg-flame px-4 py-2.5 font-mono text-[0.75rem] font-semibold tracking-[0.12em] text-paper uppercase shadow-lg sm:bottom-6 xl:hidden"
        >
          <span aria-hidden="true">◉</span> Live preview
        </button>
      )}
    </>
  )
}
