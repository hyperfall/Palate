import type { Metadata } from 'next'
import Link from 'next/link'

import { manifestByCategory } from '@/lib/storageManifest'

/** Plain-language headings for the groups the table is split into. */
const CATEGORY_TITLE: Record<string, string> = {
  necessary: 'Strictly necessary',
  preferences: 'Preferences',
  analytics: 'Analytics',
  marketing: 'Marketing',
}

const CATEGORY_NOTE: Record<string, string> = {
  necessary:
    'Needed for the site to work at all: signing in, remembering your cookie choices, and holding the costing you are part-way through. These cannot be switched off, because switching them off would break the thing you came to do.',
  preferences: 'Remembers choices you made, so you do not have to make them again.',
  analytics:
    'Counts readers and pages. Nothing is loaded and no request reaches Google until you allow this.',
  marketing:
    'For advertising measurement. We do not currently run ads; if that changes, this is what would be set.',
}

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
              <span className="font-semibold text-ink">Account details</span>. If you sign up: your
              email and profile, so you can save collections, plan meals, and publish recipes.
            </li>
            <li>
              <span className="font-semibold text-ink">A rotation cookie</span>. A random,
              non-identifying value so partner cards rotate evenly across visits rather than repeating.
            </li>
            <li>
              <span className="font-semibold text-ink">Coarse country</span>. Derived from your IP
              address by our host, used only to show partner cards relevant to your country. We don’t
              store your IP for advertising or build a profile from it.
            </li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2 className="font-display text-title text-ink">Advertising</h2>
          <p>
            Partner cards are chosen by the recipe and your country, not by tracking you around the
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
          <h2 className="font-display text-title text-ink">What is stored on your device</h2>
          <p>
            Everything below, and nothing else. The table is generated from the same declaration
            the site uses to set and clear these, so it cannot describe one thing while the code
            does another. Anything outside the first group is only stored after you allow that
            category, and switching a category off removes what it covers straight away.
          </p>
          <p className="text-slate">
            Some of these are held in your browser rather than as cookies. They are listed together
            because the rules are about storing information on your device, not about which method
            put it there.
          </p>

          {manifestByCategory().map(({ category, entries }) => (
            <div key={category} className="mt-6 min-w-0">
              <h3 className="eyebrow m-0 text-flame">{CATEGORY_TITLE[category]}</h3>
              <p className="mt-1 mb-0 text-detail text-slate">{CATEGORY_NOTE[category]}</p>

              {/* min-w-0 on both: a grid item defaults to min-width:auto, so
                  without it the table's min-width wins and the PAGE scrolls
                  sideways instead of this box. */}
              <div className="mt-3 min-w-0 overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-rule">
                      <th className="eyebrow py-2 pr-4 font-normal">Name</th>
                      <th className="eyebrow py-2 pr-4 font-normal">Set by</th>
                      <th className="eyebrow py-2 pr-4 font-normal">What it does</th>
                      <th className="eyebrow py-2 font-normal">Kept for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.name} className="border-b border-rule/60 align-top">
                        <td className="py-2.5 pr-4 font-mono text-caption text-ink">
                          {e.name}
                          {e.prefix && <span className="text-slate">…</span>}
                          <span className="block text-slate">
                            {e.kind === 'cookie' ? 'cookie' : 'in-browser'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-detail text-slate">{e.party}</td>
                        <td className="py-2.5 pr-4 text-detail text-slate">{e.purpose}</td>
                        <td className="py-2.5 text-detail whitespace-nowrap text-slate">
                          {e.retention}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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
