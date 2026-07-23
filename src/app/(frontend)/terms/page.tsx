import type { Metadata } from 'next'
import Link from 'next/link'

import { DEFAULT_CREATOR_REV_SHARE } from '@/lib/partners'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The terms that govern using Palate, publishing recipes, and advertising with us.',
}

const UPDATED = 'July 2026'

export default function TermsPage() {
  return (
    <div className="shell max-w-[68ch] py-8 lg:py-14">
      <header>
        <p className="eyebrow m-0 text-flame">Legal</p>
        <h1 className="mt-1 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1]">Terms of Use</h1>
        <p className="datum mt-2">Last updated {UPDATED}</p>
      </header>

      <div className="mt-8 grid gap-7 text-[1rem] leading-relaxed text-slate">
        <p>
          These terms govern your use of Palate. By using the site you agree to them. If you don’t
          agree, please don’t use the site. This is a plain-English summary of how we operate — not a
          substitute for legal advice.
        </p>

        <section className="grid gap-2">
          <h2 className="font-display text-[1.25rem] text-ink">Using the site</h2>
          <p>
            You may browse, cook from, and save recipes for personal, non-commercial use. Don’t
            scrape, resell, or bulk-copy the catalog, and don’t misuse the site or interfere with how
            it runs.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-[1.25rem] text-ink">Accounts</h2>
          <p>
            You’re responsible for what happens under your account and for keeping your login secure.
            You can ask us to close your account at any time.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-[1.25rem] text-ink">Creator content</h2>
          <p>
            Recipes you submit stay yours. By publishing on Palate you grant us a licence to host,
            display, and promote your recipe on the platform and in related materials, with
            attribution to you. You confirm the work is yours to share and doesn’t infringe anyone
            else’s rights. We review submissions and may decline or remove anything that breaks these
            terms.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-[1.25rem] text-ink">Advertising &amp; partners</h2>
          <p>
            Palate may show a single, clearly-labelled partner card alongside a recipe, matched to the
            dish and the reader’s country. Every partner card is marked “Partner” and its links carry{' '}
            <code className="font-mono text-[0.875rem]">rel=&quot;sponsored nofollow&quot;</code>. We
            do not take payment to alter, favour, or reorder recipes — advertising never changes the
            food.
          </p>
          <p>
            <span className="font-semibold text-ink">Creator revenue share.</span> Where a partner card
            earns revenue on a specific recipe, we share{' '}
            <span className="font-semibold text-ink">{DEFAULT_CREATOR_REV_SHARE}%</span> of that
            recipe’s attributable partner revenue with the creator who authored it; Palate retains the
            remainder to run the platform and sell the placements. Revenue is only shared once
            per-recipe measurement is in place; this share is a baseline we may raise as the platform
            grows, and specific arrangements are confirmed with creators directly.
          </p>
          <p>
            Interested in advertising?{' '}
            <Link href="/partners" className="text-flame underline underline-offset-2">
              Request a placement
            </Link>
            . We review every request by hand and may decline or end any placement at our discretion.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-[1.25rem] text-ink">No warranty</h2>
          <p>
            Recipes and nutrition figures are provided in good faith but as-is. Cooking involves
            judgement, heat, and allergens — use your own. We’re not liable for outcomes from using
            the site to the extent the law allows.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-[1.25rem] text-ink">Changes &amp; contact</h2>
          <p>
            We may update these terms; material changes will be reflected by the date above. Questions
            about these terms or a partnership can be sent through our{' '}
            <Link href="/partners" className="text-flame underline underline-offset-2">
              partner page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
