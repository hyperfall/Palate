import type { Metadata } from 'next'

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
            <h1 className="mt-1 text-[clamp(1.875rem,3vw,2.75rem)]">Pick dinner for me.</h1>
            <p className="mt-3 text-slate">
              Answer five questions. You get one recipe, not a grid — the board decides so you
              don’t have to.
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
