/** Human-readable duration. "1 h 20 min" reads faster in a kitchen than "80 min". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** ISO 8601 duration, required by Recipe JSON-LD (§8). */
export function toIsoDuration(minutes: number | null | undefined): string | undefined {
  if (!minutes || minutes <= 0) return undefined
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `PT${hours > 0 ? `${hours}H` : ''}${rest > 0 ? `${rest}M` : ''}`
}

/** "2 tbsp olive oil, finely chopped" from its parts, skipping whatever is absent. */
export function formatIngredient(ingredient: {
  quantity?: string | null
  unit?: string | null
  item: string
  note?: string | null
}): string {
  const measure = [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')
  const base = [measure, ingredient.item].filter(Boolean).join(' ')
  return ingredient.note ? `${base}, ${ingredient.note}` : base
}

export function formatTimer(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  return formatMinutes(minutes)
}

/**
 * A plate price, from pence. Shared by the students board and the recipe cards
 * so the same dish can't read £1.50 on one screen and £1.5 on another.
 */
export function formatPlatePrice(pence: number | null | undefined): string | null {
  if (pence == null || !Number.isFinite(pence)) return null
  return `£${(pence / 100).toFixed(2)}`
}
