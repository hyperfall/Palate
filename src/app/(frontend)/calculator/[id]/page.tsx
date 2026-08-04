import type { Metadata } from 'next'
import Link from 'next/link'

import { CostingLoader } from '@/components/calculator/CostingLoader'
import { loadCalculatorIngredients } from '@/lib/calculatorData'

export const metadata: Metadata = {
  title: 'Cost calculator',
  description: 'Work out what a dish costs from what you actually pay.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * One costing.
 *
 * The catalogue is fetched here because it is public and the same for everyone;
 * which costing you may open is decided by RLS in the browser, so the costing
 * itself is loaded there.
 */
export default async function CostingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ingredients = await loadCalculatorIngredients()

  return (
    <div className="shell py-10 lg:py-14">
      <p className="eyebrow m-0">
        <Link href="/calculator" className="text-slate no-underline hover:text-flame">
          ← Your costings
        </Link>
      </p>

      <CostingLoader id={id} ingredients={ingredients} />
    </div>
  )
}
