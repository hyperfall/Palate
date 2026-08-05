import type { Metadata } from 'next'

import Link from 'next/link'

import { TasteOnboarding, type OnboardingDish } from '@/components/TasteOnboarding'
import { imageFrom } from '@/lib/media'
import { getPayloadClient } from '@/lib/queries'
import { serverUser } from '@/lib/supabase/server'

export const metadata: Metadata = {
  alternates: { canonical: '/taste' },
  // Personalised and sign-in gated: to a crawler this is a thin sign-in
  // prompt, so keep it out of the index like every other private page.
  robots: { index: false, follow: false },
  title: 'Find your taste',
  description: 'Rate a few dishes and we’ll learn what you lean toward, then tune tonight’s dinner and the catalog to it.',
}

export const dynamic = 'force-dynamic'

/** Pick ~8 dishes that span the taste space, so the ratings are informative. */
async function pickDishes(): Promise<OnboardingDish[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: { and: [{ status: { equals: 'published' } }, { heroImage: { exists: true } }] },
    depth: 1,
    limit: 40,
  })

  // Spread across the richness axis so the set isn't all one note; take 8.
  const withImage = result.docs.filter((r) => imageFrom(r.heroImage, 'card'))
  const spread = [...withImage].sort((a, b) => (a.richness ?? 0) - (b.richness ?? 0))
  const step = Math.max(1, Math.floor(spread.length / 8))
  const chosen = spread.filter((_, i) => i % step === 0).slice(0, 8)

  return chosen.map((r) => {
    const cuisine = typeof r.cuisine === 'object' ? r.cuisine : null
    const image = imageFrom(r.heroImage, 'card')
    return {
      id: r.id,
      title: r.title,
      cuisine: cuisine ? `${cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}${cuisine.name}` : null,
      image: image ? { url: image.url, alt: image.alt } : null,
      taste: {
        spiciness: r.spiciness ?? 0,
        sweetness: r.sweetness ?? 0,
        richness: r.richness ?? 0,
        effort: r.effort ?? 0,
      },
    }
  })
}

export default async function TastePage() {
  const user = await serverUser()
  if (!user) {
    return (
      <div className="shell py-14">
        <div className="max-w-[46ch]">
          <p className="eyebrow m-0">Find your taste</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Rate a few dishes.</h1>
          <p className="mt-3 text-slate max-sm:hidden">
            Your taste profile saves to your account, then personalises tonight’s pick and the
            catalog. Sign in to build it.
          </p>
          <Link href="/account" className="btn-primary mt-6 inline-block">
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const dishes = await pickDishes()

  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[46rem]">
        <p className="eyebrow m-0">Find your taste</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Rate a few dishes.</h1>
        <p className="mt-3 max-w-[52ch] text-slate max-sm:hidden">
          Say yes to what you’d happily eat. We’ll average the ones you like into a taste profile.
          then tonight’s pick and the catalog can start from it.
        </p>
      </div>
      <div className="mt-8 max-w-[52rem]">
        {dishes.length > 0 ? (
          <TasteOnboarding dishes={dishes} />
        ) : (
          <p className="text-slate">No dishes to rate yet. Check back once the catalog has photos.</p>
        )}
      </div>
    </div>
  )
}
