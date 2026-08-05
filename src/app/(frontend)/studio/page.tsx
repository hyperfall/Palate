import type { Metadata } from 'next'

import { StudioForm } from '@/components/StudioForm'
import { findCuisines } from '@/lib/queries'
import { DEFAULT_CREATOR_REV_SHARE } from '@/lib/partners'

export const metadata: Metadata = {
  alternates: { canonical: '/studio' },
  title: 'Creator Studio',
  description: 'Publish your recipes on Palate: your food, your name, your links.',
}

export const revalidate = 3600

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
          Your food, your photo, your name, with a link back to wherever you create. Submissions
          are reviewed by a human before they go live.
        </p>
        {/* The deal, where the decision happens. Three separate user-journey
            agents couldn't find the creator's cut anywhere but the ADVERTISER
            page — the one page a deciding creator has no reason to open. Plain
            prose, deliberately not the numbered strip this page used to have. */}
        <p className="mt-3 text-note leading-relaxed text-slate">
          The deal: a person reads every submission, usually within a few days. If it isn’t right
          for the board, you’ll hear why, and you can send another. Your recipe stays yours, your
          links stay on it, and {DEFAULT_CREATOR_REV_SHARE}% of any partner revenue it earns is
          yours as revenue sharing rolls out.
        </p>
      </header>

      <div className="mt-10">
        <StudioForm
          cuisines={cuisines.map((c) => ({ id: c.id, name: c.name, flagEmoji: c.flagEmoji }))}
        />
      </div>
    </div>
  )
}
