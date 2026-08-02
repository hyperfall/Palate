import type { Metadata } from 'next'
import Link from 'next/link'

import { PartnerCardExample } from '@/components/PartnerCardExample'
import { PartnerRequestForm } from '@/components/PartnerRequestForm'
import { DEFAULT_CREATOR_REV_SHARE } from '@/lib/partners'

export const metadata: Metadata = {
  alternates: { canonical: '/partners' },
  title: 'Advertise with us',
  description:
    'Reach cooks at the moment they’re choosing what to make — one labelled partner card per recipe, targeted by country and dish. Request a placement.',
}

const HOW = [
  {
    n: '01',
    t: 'One card, in context',
    d: 'A single labelled partner card sits beside the recipe — never a banner farm, never mistaken for editorial.',
  },
  {
    n: '02',
    t: 'Targeted by country and dish',
    d: 'We show your card to cooks in the countries you choose, on the recipes and cuisines that fit. No match, no impression.',
  },
  {
    n: '03',
    t: 'Fair rotation',
    d: 'When several partners fit the same recipe, we rotate them evenly so everyone gets real screen time.',
  },
]

/**
 * Sample cards. Invented brands on purpose — showing a real company's name and
 * mark here would imply a partnership that does not exist.
 */
const EXAMPLES = [
  { brand: 'Ridgeway Mill', tagline: 'Stoneground flour, milled in Devon this week.', ctaLabel: 'Shop flour', swatch: '#7d5a3c' },
  { brand: 'Copper & Co', tagline: 'Pans that outlive the recipes you cook in them.', ctaLabel: 'See the range', swatch: '#b4622f' },
  { brand: 'Saltwick', tagline: 'Flaky sea salt, hand-harvested off the Norfolk coast.', ctaLabel: 'Try a box', swatch: '#3f5a63' },
] as const

/**
 * What to send us. Sizes are the ones the media pipeline actually generates, so
 * a partner supplying at the top of this range gets a sharp card on a retina
 * screen instead of an upscale.
 */
const CREATIVE_SPEC: Array<[string, string]> = [
  ['Images per campaign', 'Up to 8, rotated evenly'],
  ['Image size', '800×600 or larger, square-safe'],
  ['Format', 'JPG or PNG — no SVG'],
  ['Tagline', 'One line, 160 characters'],
  ['Button label', '2–3 words'],
  ['Destination', 'https:// only'],
]

export default function PartnersPage() {
  return (
    <div className="shell py-8 lg:py-14">
      <header className="max-w-[52ch]">
        <p className="eyebrow m-0 text-flame">Advertise with us</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)] leading-[1.1]">
          Reach cooks the moment they decide.
        </h1>
        <p className="mt-3 text-read leading-relaxed text-slate">
          Palate readers arrive with intent — they’re about to cook. One tasteful, labelled partner
          card per recipe, matched to the dish and the reader’s country.
        </p>
      </header>

      <ol className="mt-10 grid list-none gap-6 p-0 sm:grid-cols-3">
        {HOW.map((step) => (
          <li key={step.n} className="ticket-card p-5">
            <p className="datum m-0 text-flame">{step.n}</p>
            <p className="mt-2 font-display text-[1.1875rem] leading-tight text-ink">{step.t}</p>
            <p className="mt-1.5 text-note leading-snug text-slate">{step.d}</p>
          </li>
        ))}
      </ol>

      {/*
          Show the placement. A brand was being asked to commit budget and
          artwork to something described only in prose — three examples make the
          format, the label and the one-line limit concrete, and demonstrate the
          set of creatives a single campaign can rotate.
      */}
      <section className="mt-14 border-t-2 border-ink pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-display text-[1.375rem]">This is the placement</h2>
          <p className="m-0 max-w-[46ch] text-note text-slate">
            One card, in the margin beside the method — where a reader is already
            deciding what to buy. Supply several images and we rotate them evenly.
          </p>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {EXAMPLES.map((e) => (
            <PartnerCardExample key={e.brand} {...e} />
          ))}
        </div>
        <dl className="mt-8 grid max-w-[62ch] gap-2.5">
          {CREATIVE_SPEC.map(([label, value]) => (
            <div key={label} className="leader">
              <dt className="eyebrow">{label}</dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>
          <h2 className="font-display text-[1.375rem]">Request a placement</h2>
          <p className="mt-2 max-w-[56ch] text-slate">
            Tell us a little about the brand and what you’d like to promote. We review every request
            by hand and reply by email — no auto-approvals, no auction.
          </p>
          <div className="mt-6">
            <PartnerRequestForm />
          </div>
        </div>

        <aside className="ticket-card p-5 lg:sticky lg:top-24">
          <p className="eyebrow m-0">Good to know</p>
          <ul className="mt-3 grid list-none gap-3 p-0 text-note leading-snug text-slate">
            <li>Every partner card is labelled “Partner”. We never take money to change a recipe.</li>
            <li>Links carry <code className="font-mono text-detail">rel=&quot;sponsored nofollow&quot;</code>.</li>
            <li>
              We share <span className="font-semibold text-ink">{DEFAULT_CREATOR_REV_SHARE}%</span> of a
              recipe’s partner revenue with the creator who wrote it.
            </li>
            <li>
              See the{' '}
              <Link href="/terms" className="text-flame underline underline-offset-2">
                advertising terms
              </Link>
              .
            </li>
          </ul>
        </aside>
      </section>
    </div>
  )
}
