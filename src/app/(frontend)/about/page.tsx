import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Palate is a recipe-first platform: cook first, read later. Creator-authored recipes, honest advertising, and a taste-led way to decide what to make.',
}

export default function AboutPage() {
  return (
    <div className="shell max-w-[68ch] py-8 lg:py-14">
      <header>
        <p className="eyebrow m-0 text-flame">About</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)] leading-[1.1]">
          Cook first. Read later, if you feel like it.
        </h1>
      </header>

      <div className="mt-8 grid gap-6 text-[1.0625rem] leading-relaxed text-slate">
        <p>
          Most recipe sites bury the food under a life story, a wall of ads, and a photo of someone’s
          childhood kitchen. Palate is the opposite bet: the recipe comes first, measured on the few
          things that actually decide whether you’ll make it tonight — how it tastes, how long it
          takes, what it costs, and how much effort it really is.
        </p>
        <p>
          Every recipe is written by a person and published under their name. We don’t scrape or
          spin up filler — the catalog grows as real creators bring their food to the platform.
        </p>

        <h2 className="mt-4 font-display text-[1.375rem] text-ink">How we make money, honestly</h2>
        <p>
          A single, clearly-labelled partner card can appear beside a recipe — matched to the dish
          and to your country, and rotated fairly when more than one brand fits. It’s always marked
          “Partner”, its links never pass search credit, and{' '}
          <span className="font-semibold text-ink">we never take money to change a recipe</span>. When
          a partner card earns on a recipe, we share part of that revenue with the creator who wrote
          it.
        </p>
        <p>
          Curious about advertising?{' '}
          <Link href="/partners" className="text-flame underline underline-offset-2">
            Partner with us
          </Link>
          . Want the fine print?{' '}
          <Link href="/terms" className="text-flame underline underline-offset-2">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-flame underline underline-offset-2">
            Privacy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
