import { TASTE_AXES, TASTE_AXIS_LABELS, tasteLabel, type TasteAxis } from '@/lib/taxonomy'

export const AXIS_COLOR: Record<TasteAxis, string> = {
  spiciness: 'var(--color-heat)',
  sweetness: 'var(--color-sweetness)',
  richness: 'var(--color-richness)',
  effort: 'var(--color-effort)',
}

const STEPS = [0, 1, 2, 3, 4, 5]

/**
 * The taste meter — the site's signature instrument.
 *
 * Square graduations on a printed scale, read like a gauge on a range hood.
 * The value is announced as a *word* ("Fiery", "Effortless"): integers in the
 * DB, labels in the UI (§11 Q3). The empty ticks stay visible so a value reads
 * as a measurement on a scale, not a progress bar.
 */
export function TasteGauge({ axis, value }: { axis: TasteAxis; value: number }) {
  const label = TASTE_AXIS_LABELS[axis].title
  const readout = tasteLabel(axis, value)

  return (
    <div className="gauge" style={{ ['--gauge-hue' as string]: AXIS_COLOR[axis] }}>
      <div className="leader">
        <span className="eyebrow">{label}</span>
        <span className="leader__dots" aria-hidden="true" />
        <span className="gauge__readout">{readout}</span>
      </div>
      <div
        className="gauge__track"
        role="meter"
        // The visible label sits in a sibling element, so the meter needs its
        // own name — otherwise a screen reader announces "Fiery" with no
        // indication of what is fiery.
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-valuetext={readout ?? undefined}
      >
        {STEPS.map((step) => (
          <span
            key={step}
            className="gauge__tick"
            data-filled={step > 0 && step <= value}
            data-zero={step === 0}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Card-scale summary: the two facts that decide whether someone cooks a dish
 * tonight, said in words — the dominant flavour (any axis at 3+) and effort,
 * always. Colour squares keep the axis hues teaching themselves across a grid.
 */
export function TasteTags({
  recipe,
  className = '',
}: {
  recipe: Record<TasteAxis, number>
  className?: string
}) {
  const flavourAxes: TasteAxis[] = ['spiciness', 'sweetness', 'richness']

  const dominant = flavourAxes
    .map((axis) => ({ axis, value: recipe[axis] }))
    .filter(({ value }) => value >= 3)
    .sort((a, b) => b.value - a.value)[0]

  const tags: TasteAxis[] = dominant ? [dominant.axis, 'effort'] : ['effort']

  return (
    <ul className={`m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 ${className}`}>
      {tags.map((axis) => (
        <li key={axis} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0 rounded-[1px]"
            style={{ background: AXIS_COLOR[axis] }}
          />
          <span className="font-mono text-[0.8125rem] font-medium tracking-[0.04em] text-slate uppercase">
            <span className="sr-only">{TASTE_AXIS_LABELS[axis].title}: </span>
            {tasteLabel(axis, recipe[axis])}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * All four meters. Stacked by default; `row` renders them as bare siblings so
 * they can take one cell each in a parent grid (the recipe ticket band).
 */
export function TastePanel({
  recipe,
  row = false,
}: {
  recipe: Record<TasteAxis, number>
  row?: boolean
}) {
  const gauges = TASTE_AXES.map((axis) => (
    <TasteGauge key={axis} axis={axis} value={recipe[axis]} />
  ))

  if (row) return <>{gauges}</>
  return <div className="grid gap-4">{gauges}</div>
}
