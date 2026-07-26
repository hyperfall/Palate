import { DAILY_REFERENCE_INTAKES, trafficLight, type TrafficNutrient } from '@/lib/nutrition'

type RecipeNutrition = {
  calories?: number | null
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  saturates?: number | null
  sugars?: number | null
  fibre?: number | null
  salt?: number | null
  servingGrams?: number | null
}

/** Level → the taste-axis tokens, so the lights stay on the site's palette and
 *  theme-aware rather than importing stoplight hexes. */
const LIGHT_CLASS = {
  green: 'bg-richness',
  amber: 'bg-sweetness',
  red: 'bg-heat',
} as const

/**
 * Per-serving nutrition in food-label grammar: the eight familiar values, a
 * percentage of a 2,000 kcal reference day beside each, and low/medium/high
 * dots for the four watch nutrients (banded per 100g via the serving weight,
 * which is the basis such thresholds are defined on). Country-neutral on
 * purpose — a global audience shouldn't be reading another country's scheme.
 * Typeset as ticket lines like the ingredients — label, leader, datum.
 */
export function NutritionPanel({ nutrition }: { nutrition: RecipeNutrition | null | undefined }) {
  if (nutrition?.calories == null) return null

  const grams = nutrition.servingGrams ?? null
  const per100 = (perServing: number | null | undefined): number | null =>
    perServing != null && grams != null && grams > 0 ? (perServing / grams) * 100 : null

  const rows: Array<{
    label: string
    value: number | null | undefined
    unit: string
    ri: number
    light?: TrafficNutrient
  }> = [
    { label: 'Calories', value: nutrition.calories, unit: ' kcal', ri: DAILY_REFERENCE_INTAKES.calories },
    { label: 'Fat', value: nutrition.fat, unit: ' g', ri: DAILY_REFERENCE_INTAKES.fat, light: 'fat' },
    { label: 'Saturates', value: nutrition.saturates, unit: ' g', ri: DAILY_REFERENCE_INTAKES.saturates, light: 'saturates' },
    { label: 'Carbs', value: nutrition.carbs, unit: ' g', ri: DAILY_REFERENCE_INTAKES.carbs },
    { label: 'Sugars', value: nutrition.sugars, unit: ' g', ri: DAILY_REFERENCE_INTAKES.sugars, light: 'sugars' },
    { label: 'Fibre', value: nutrition.fibre, unit: ' g', ri: DAILY_REFERENCE_INTAKES.fibre },
    { label: 'Protein', value: nutrition.protein, unit: ' g', ri: DAILY_REFERENCE_INTAKES.protein },
    { label: 'Salt', value: nutrition.salt, unit: ' g', ri: DAILY_REFERENCE_INTAKES.salt, light: 'salt' },
  ]

  return (
    <div className="mt-8 border-t border-rule pt-5">
      <p className="eyebrow m-0">Nutrition · per serving</p>
      <dl className="mt-3 grid gap-2">
        {rows.map((row) => {
          if (row.value == null) return null
          const p100 = row.light ? per100(row.value) : null
          const light = row.light && p100 != null ? trafficLight(row.light, p100) : null
          const pctRi = Math.round((row.value / row.ri) * 100)
          return (
            <div key={row.label} className="leader">
              <dt className="eyebrow flex items-center gap-1.5">
                {light && (
                  <span
                    aria-hidden="true"
                    title={`${light === 'green' ? 'Low' : light === 'amber' ? 'Medium' : 'High'} per 100 g`}
                    className={`h-2 w-2 shrink-0 rounded-full ${LIGHT_CLASS[light]}`}
                  />
                )}
                {row.label}
              </dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0">
                {row.value}
                {row.unit}
                <span className="ml-1.5 font-normal text-slate">{pctRi}%</span>
              </dd>
            </div>
          )
        })}
      </dl>
      <p className="mt-2.5 font-mono text-[0.6875rem] tracking-[0.08em] text-slate/70 uppercase">
        Estimated from ingredients · % of a 2,000 kcal reference day
        {grams ? ` · serving ≈ ${grams} g` : ''}
      </p>
    </div>
  )
}
