import type { Metadata } from 'next'

import { CollectionsBoard } from '@/components/CollectionsBoard'

export const metadata: Metadata = {
  title: 'My collections',
  description: 'Every recipe you’ve saved, in collections you named yourself.',
  // Private to each signed-in user — never index.
  robots: { index: false, follow: false },
}

export default function CollectionsPage() {
  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Saved</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">My collections.</h1>
      </header>

      <div className="mt-10">
        <CollectionsBoard />
      </div>
    </div>
  )
}
