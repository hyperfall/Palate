import type { Metadata } from 'next'

import { CostingList } from '@/components/calculator/CostingList'
import { loadCalculatorIngredients } from '@/lib/calculatorData'
import type { CatalogueEntry } from '@/lib/useCosting'

export const metadata: Metadata = {
  title: 'Cost calculator',
  description: 'Work out what a dish costs from what you actually pay.',
  // Personal, and not a page worth ranking — the recipes are.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function CalculatorPage() {
  // The same public catalogue the editor uses. The list needs it to total each
  // costing: a row saying "3 cloves" is only convertible with the per-piece
  // weight, and without it the figures beside each name would under-report.
  const ingredients = await loadCalculatorIngredients()
  const catalogue = new Map<string, CatalogueEntry>(
    ingredients.map((i) => [
      i.slug,
      {
        slug: i.slug,
        name: i.name,
        densityGPerMl: i.densityGPerMl,
        gramsPerPiece: i.gramsPerPiece,
        baseline: i.baseline,
      },
    ]),
  )

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[60ch]">
        <p className="eyebrow m-0 text-flame">Costs</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">What does it cost?</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Add what a dish is made of and what you paid for each thing, and it totals as you go. The
          whole dish, and what one plate comes to. Prices you correct are kept, so the next dish
          starts from your shop rather than our estimate.
        </p>
      </header>

      <CostingList catalogue={catalogue} />
    </div>
  )
}
