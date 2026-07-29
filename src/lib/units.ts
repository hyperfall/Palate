/**
 * US ⇄ metric conversion for recipe measures, plus friendly-fraction humanising.
 * Only the units that genuinely differ between systems convert — cup/floz⇄ml,
 * oz/lb⇄g/kg, °F⇄°C. tsp/tbsp and non-measure units (clove, pinch, can, counts)
 * are universal and pass through, because converting "1 tbsp" to "15 ml" is
 * noise, not help. Pure functions — no React, no I/O.
 */
export type UnitSystem = 'us' | 'metric'

// ml per US volume unit that we treat as system-specific.
const US_VOLUME_ML: Record<string, number> = { cup: 240, floz: 29.6, 'fl oz': 29.6 }
// grams per US weight unit. Bare "oz" is weight by design — fluid ounces are
// their own entry ("fl oz"/"floz") in US_VOLUME_ML above, which is how a recipe
// should spell a liquid ounce. A plain "oz" is treated as weight rather than
// guessed, so we never silently convert "8 oz milk" as if it were grams-by-volume.
const US_WEIGHT_G: Record<string, number> = { oz: 28, lb: 454 }

const round1 = (n: number) => Math.round(n * 10) / 10

export function convertMeasure(
  quantity: number,
  unit: string,
  system: UnitSystem,
): { quantity: number; unit: string } {
  const u = unit.trim().toLowerCase()

  if (system === 'metric') {
    if (u in US_VOLUME_ML) {
      const ml = quantity * US_VOLUME_ML[u]
      return ml >= 1000 ? { quantity: round1(ml / 1000), unit: 'l' } : { quantity: Math.round(ml), unit: 'ml' }
    }
    if (u in US_WEIGHT_G) {
      const g = quantity * US_WEIGHT_G[u]
      return g >= 1000 ? { quantity: round1(g / 1000), unit: 'kg' } : { quantity: Math.round(g), unit: 'g' }
    }
    return { quantity, unit }
  }

  // → US
  if (u === 'ml' || u === 'l') {
    const ml = u === 'l' ? quantity * 1000 : quantity
    if (ml >= 236) return { quantity: round1(ml / 240), unit: 'cup' }
    return { quantity: round1(ml / 29.6), unit: 'fl oz' }
  }
  if (u === 'g' || u === 'kg') {
    const g = u === 'kg' ? quantity * 1000 : quantity
    if (g >= 454) return { quantity: round1(g / 454), unit: 'lb' }
    return { quantity: round1(g / 28), unit: 'oz' }
  }
  return { quantity, unit }
}

const VULGAR: Array<[number, string]> = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.67, '⅔'],
  [0.75, '¾'],
]

/**
 * Units you measure by eye with a cup or spoon, where "⅓" is a real marking on
 * a real object. Weights are not among them: a scale reads 1.3 lb and has no
 * way to show you a third of a pound, so "1⅓ lb" is a number you cannot act on.
 */
const FRACTIONAL_UNITS = new Set(['cup', 'cups', 'tsp', 'tbsp', 'fl oz', 'pint', 'quart'])

export function humanizeQuantity(
  value: number,
  opts: { countable?: boolean; unit?: string } = {},
): string {
  if (opts.countable) {
    // Discrete items never read as fractions; never round a real ingredient to 0.
    return String(Math.max(1, Math.round(value)))
  }
  const whole = Math.floor(value)
  const frac = value - whole
  // A unit we know is spoon-or-cup shaped gets fractions; anything else — and
  // anything unlabelled — gets the decimal a scale can actually display.
  const spoonable = opts.unit === undefined || FRACTIONAL_UNITS.has(opts.unit.toLowerCase())
  if (spoonable) {
    for (const [v, glyph] of VULGAR) {
      if (Math.abs(frac - v) < 0.05) return whole > 0 ? `${whole}${glyph}` : glyph
    }
  }
  if (frac < 0.05) return String(whole)
  return String(Math.round(value * 100) / 100)
}

const TEMP_RE = /(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi

export function convertTemperatures(text: string, system: UnitSystem): string {
  // Oven temps read best rounded to the nearest 5°.
  const to5 = (n: number) => Math.round(n / 5) * 5
  return text.replace(TEMP_RE, (whole, num: string, unit: string) => {
    const value = Number.parseFloat(num)
    const isF = unit.toUpperCase() === 'F'
    if (system === 'metric' && isF) return `${to5(((value - 32) * 5) / 9)}°C`
    if (system === 'us' && !isF) return `${to5((value * 9) / 5 + 32)}°F`
    return whole // already in the target system
  })
}
