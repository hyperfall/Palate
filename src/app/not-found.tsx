import Link from 'next/link'
import { Figtree, Young_Serif } from 'next/font/google'

import './(frontend)/styles.css'

/**
 * Root 404 — catches top-level unmatched URLs that fall outside every route
 * group (the (frontend) not-found only covers routes within its segment).
 * Self-contained: its own html/body since no root layout wraps it.
 */
const display = Young_Serif({ subsets: ['latin'], weight: '400', variable: '--font-display' })
const body = Figtree({ subsets: ['latin'], variable: '--font-body' })

export default function RootNotFound() {
  return (
    <html lang="en" data-theme="light" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="shell grid min-h-screen place-items-center py-16">
          <div className="ticket-card max-w-[34rem] p-8 text-center">
            <p className="eyebrow m-0 text-flame">Docket 404</p>
            <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3rem)]">
              This ticket isn’t on the pass.
            </h1>
            <p className="mx-auto mt-3 max-w-[38ch] text-slate">
              Whatever you were after has been cleared, renamed, or never printed. The kitchen’s
              still open.
            </p>
            <Link href="/recipes" className="btn-primary mt-7">
              Browse the board
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
