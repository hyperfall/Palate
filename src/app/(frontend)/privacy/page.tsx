import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy',
  description:
    'What Palate collects and why: account data, a rotation cookie, and coarse country from your IP to target partner cards. We don’t sell your data.',
}

const UPDATED = 'July 2026'

export default function PrivacyPage() {
  return (
    <div className="shell max-w-[68ch] py-8 lg:py-14">
      <header>
        <p className="eyebrow m-0 text-flame">Legal</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)] leading-[1.1]">Privacy</h1>
        <p className="datum mt-2">Last updated {UPDATED}</p>
      </header>

      <div className="mt-8 grid gap-7 text-[1rem] leading-relaxed text-slate">
        <p>
          Palate is operated by {SITE.company}, which is the data controller for the information
          described here. We try to collect as little as possible. This note explains what we do
          collect and why, in plain English. It isn’t legal advice.
        </p>

        <section className="grid gap-2">
          <h2 className="font-display text-title text-ink">What we collect</h2>
          <ul className="m-0 grid list-disc gap-2 pl-5">
            <li>
              <span className="font-semibold text-ink">Account details</span> — if you sign up: your
              email and profile, so you can save collections, plan meals, and publish recipes.
            </li>
            <li>
              <span className="font-semibold text-ink">A rotation cookie</span> — a random,
              non-identifying value so partner cards rotate evenly across visits rather than repeating.
            </li>
            <li>
              <span className="font-semibold text-ink">Coarse country</span> — derived from your IP
              address by our host, used only to show partner cards relevant to your country. We don’t
              store your IP for advertising or build a profile from it.
            </li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-title text-ink">Advertising</h2>
          <p>
            Partner cards are chosen by the recipe and your country — not by tracking you around the
            web. They’re always labelled, and their links carry{' '}
            <code className="font-mono text-eyebrow">rel=&quot;sponsored nofollow&quot;</code>. You
            can adjust non-essential cookies any time from the “Cookie settings” link in the footer.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-title text-ink">What we don’t do</h2>
          <p>
            We don’t sell your personal information, and we don’t share it with advertisers. Partners
            get aggregate performance, never your identity.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-title text-ink">Your choices</h2>
          <p>
            You can manage cookie consent from the footer, and ask us to close your account and remove
            your data. Questions can be sent through our{' '}
            <Link href="/partners" className="text-flame underline underline-offset-2">
              contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
