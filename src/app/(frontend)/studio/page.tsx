import type { Metadata } from 'next'

import { StudioForm } from '@/components/StudioForm'
import { findCuisines } from '@/lib/queries'
import { DEFAULT_CREATOR_REV_SHARE } from '@/lib/partners'

export const metadata: Metadata = {
  title: 'Creator Studio',
  description: 'Publish your recipes on Palate — your food, your name, your links.',
}

export const revalidate = 3600

/** The creator deal, up front — so publishing here is never a black box. */
const STEPS = [
  { n: '01', t: 'Submit', d: 'Your photo, your method, your honest taste call.' },
  { n: '02', t: 'We review by hand', d: 'A person checks every recipe — usually within a few days, never a bot.' },
  { n: '03', t: 'It goes live under your name', d: 'Published with your byline and your links back to wherever you cook.' },
  {
    n: '04',
    t: 'You keep it',
    d: `Your recipe stays yours — plus ${DEFAULT_CREATOR_REV_SHARE}% of any partner revenue it earns, as revenue sharing rolls out.`,
  },
] as const

/**
 * The creator studio: where the platform stops being a demo and starts being
 * alive. Uploads land in moderation; approval publishes with the creator's
 * name and provenance. The scraped catalog is furniture — this is the door.
 */
export default async function StudioPage() {
  const cuisines = await findCuisines()

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[58ch]">
        <p className="eyebrow m-0 text-flame">Creator Studio</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Put your recipe on the pass.</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Your food, your photo, your name — with a link back to wherever you create. Submissions
          are reviewed by a human before they go live.
        </p>
      </header>

      <ol className="mt-8 grid list-none gap-x-6 gap-y-5 border-y border-rule py-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li key={step.n}>
            <p className="datum m-0 text-flame">{step.n}</p>
            <p className="mt-1.5 font-body text-[0.9375rem] font-semibold text-ink">{step.t}</p>
            <p className="mt-1 text-[0.875rem] leading-snug text-slate">{step.d}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <StudioForm
          cuisines={cuisines.map((c) => ({ id: c.id, name: c.name, flagEmoji: c.flagEmoji }))}
        />
      </div>
    </div>
  )
}
