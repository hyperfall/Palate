import type { Metadata } from 'next'
import Link from 'next/link'

import { TonightPicker } from '@/components/TonightPicker'

export const metadata: Metadata = {
  title: 'Pick dinner for me',
  description:
    'Five quick taps — heat, sweetness, richness, effort, and time — and Palate hands you one dinner, stated with confidence.',
}

export const revalidate = 3600

/**
 * The anti-grid. The catalog is for browsing; this page is for the other
 * mood — decision fatigue at 6pm. Five taps in, one recipe out.
 */
export default async function TonightPage() {
  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[56rem]">
        <div>
          <header className="max-w-[56ch]">
            <p className="eyebrow m-0">Tonight</p>
            <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Pick dinner for me.</h1>
            <p className="mt-3 text-slate max-sm:hidden">
              Answer five questions. You get one recipe, not a grid — the board decides so you
              don’t have to.
            </p>
            <p className="mt-3 font-mono text-[0.8125rem] text-slate">
              Tired of answering?{' '}
              <Link href="/taste" className="text-flame underline underline-offset-4 hover:no-underline">
                Set your taste profile
              </Link>{' '}
              and we’ll prefill these.
            </p>
          </header>

          <div className="mt-10">
            <TonightPicker />
          </div>
        </div>
      </div>
    </div>
  )
}
