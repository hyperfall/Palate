import Link from 'next/link'

import { CookieSettingsButton } from '@/components/ConsentManager'
import { AXIS_COLOR } from '@/components/TasteGauge'
import { SITE } from '@/lib/site'
import { TASTE_AXES, TASTE_AXIS_LABELS } from '@/lib/taxonomy'

/**
 * End of service. The footer speaks the same ticket language as the rest of
 * the pass: every link is a dotted-leader line — name, dots, destination —
 * like the tail of a kitchen ticket, grouped by what you're trying to do.
 * The oversized wordmark still runs underneath like a stamp.
 */
const COOK_LINKS = [
  { href: '/tonight', label: 'Pick dinner for me', datum: 'five taps' },
  { href: '/taste-night', label: 'Taste Night', datum: 'the quiz' },
  { href: '/students', label: 'Studying hard?', datum: 'budget' },
] as const

const BROWSE_LINKS = [
  { href: '/recipes', label: 'All recipes', datum: 'the board' },
  { href: '/browse', label: 'Collections', datum: 'curated' },
  { href: '/cuisines', label: 'Cuisines', datum: 'by country' },
  { href: '/ingredients', label: 'Ingredients', datum: 'the pantry' },
  { href: '/ranking/all', label: 'Ranking', datum: 'most voted' },
  { href: '/collections', label: 'Saved', datum: 'your shelf' },
] as const

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/support', label: 'Support us' },
  { href: '/partners', label: 'Advertise' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
] as const

function LeaderLink({ href, label, datum }: { href: string; label: string; datum: string }) {
  return (
    <li>
      <Link href={href} className="leader group py-1 no-underline">
        <span className="font-mono text-[0.8125rem] text-milk group-hover:text-flame">
          {label}
        </span>
        <span className="leader__dots border-milk/20" aria-hidden="true" />
        <span className="font-mono text-[0.8125rem] tracking-[0.08em] text-milk/75 uppercase">
          {datum}
        </span>
      </Link>
    </li>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-pan text-milk">
      <div className="shell grid gap-x-14 gap-y-10 py-14 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <p className="m-0 font-display text-[1.75rem] leading-tight">That’s service.</p>
          <p className="mt-3 max-w-[34ch] font-body text-[0.9375rem] leading-relaxed text-milk/85">
            {SITE.description}
          </p>
        </div>

        <div>
          <p className="eyebrow text-milk/75">Cook</p>
          <ul className="mt-3 list-none space-y-1 p-0">
            {COOK_LINKS.map((link) => (
              <LeaderLink key={link.href} {...link} />
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow text-milk/75">Browse</p>
          <ul className="mt-3 list-none space-y-1 p-0">
            {BROWSE_LINKS.map((link) => (
              <LeaderLink key={link.href} {...link} />
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow text-milk/75">Sort by taste</p>
          <ul className="mt-3 list-none space-y-1 p-0">
            {TASTE_AXES.map((axis) => (
              <li key={axis}>
                <Link href={`/recipes?sort=${axis}`} className="leader group py-1 no-underline">
                  <span className="inline-flex items-center gap-2 font-mono text-[0.8125rem] text-milk group-hover:text-flame">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 rounded-[2px]"
                      style={{ background: AXIS_COLOR[axis] }}
                    />
                    {TASTE_AXIS_LABELS[axis].title}
                  </span>
                  <span className="leader__dots border-milk/20" aria-hidden="true" />
                  <span className="font-mono text-[0.8125rem] tracking-[0.08em] text-milk/75 uppercase">
                    most first
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The oversized wordmark — cropped at the baseline, like a stamp. */}
      <div className="shell overflow-hidden" aria-hidden="true">
        <p className="m-0 -mb-[0.24em] font-display text-[clamp(5rem,17vw,20rem)] leading-none text-milk/[0.13] select-none">
          {SITE.name}
        </p>
      </div>

      <div className="border-t border-pan-line">
        <div className="shell grid gap-4 py-5">
          <p className="eyebrow m-0 text-milk/80">
            Partner cards on this site are marked. We take no money to change a recipe.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <nav aria-label="Company" className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {COMPANY_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="eyebrow m-0 text-milk/70 uppercase no-underline hover:text-flame"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <CookieSettingsButton className="eyebrow m-0 cursor-pointer border-none bg-transparent p-0 text-milk/70 uppercase hover:text-flame" />
              <CookieSettingsButton className="eyebrow m-0 cursor-pointer border-none bg-transparent p-0 text-milk/70 uppercase hover:text-flame">
                Do Not Sell or Share My Info
              </CookieSettingsButton>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
