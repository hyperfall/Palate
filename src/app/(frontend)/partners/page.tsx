import type { Metadata } from 'next'

import { PartnerRequestForm } from '@/components/PartnerRequestForm'
import { DEFAULT_CREATOR_REV_SHARE } from '@/lib/partners'

export const metadata: Metadata = {
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

export default function PartnersPage() {
  return (
    <div className="shell py-8 lg:py-14">
      <header className="max-w-[52ch]">
        <p className="eyebrow m-0 text-flame">Advertise with us</p>
        <h1 className="mt-1 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1]">
          Reach cooks the moment they decide.
        </h1>
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-slate">
          Palate readers arrive with intent — they’re about to cook. One tasteful, labelled partner
          card per recipe, matched to the dish and the reader’s country.
        </p>
      </header>

      <ol className="mt-10 grid list-none gap-6 p-0 sm:grid-cols-3">
        {HOW.map((step) => (
          <li key={step.n} className="ticket-card p-5">
            <p className="datum m-0 text-flame">{step.n}</p>
            <p className="mt-2 font-display text-[1.1875rem] leading-tight text-ink">{step.t}</p>
            <p className="mt-1.5 text-[0.9375rem] leading-snug text-slate">{step.d}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
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
          <ul className="mt-3 grid list-none gap-3 p-0 text-[0.9375rem] leading-snug text-slate">
            <li>Every partner card is labelled “Partner”. We never take money to change a recipe.</li>
            <li>Links carry <code className="font-mono text-[0.8125rem]">rel=&quot;sponsored nofollow&quot;</code>.</li>
            <li>
              We share <span className="font-semibold text-ink">{DEFAULT_CREATOR_REV_SHARE}%</span> of a
              recipe’s partner revenue with the creator who wrote it.
            </li>
            <li>
              See the{' '}
              <a href="/terms" className="text-flame underline underline-offset-2">
                advertising terms
              </a>
              .
            </li>
          </ul>
        </aside>
      </section>
    </div>
  )
}
