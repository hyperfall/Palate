/**
 * Partner-advertising shared contract: the revenue-share baseline, the budget
 * bands the request form offers, and the validation the public apply route and
 * the form agree on. Pure — no Payload/Next imports — so both sides import it.
 */

/**
 * Share of a recipe's partner ad revenue that goes to the recipe's creator.
 *
 * Baseline reasoning: the content-platform standard is YouTube's 55/45
 * (creator/platform); the publisher model (Mediavine/Raptive ~75% to the site
 * owner) doesn't apply here because Palate owns the site, not the creator. As a
 * new business seeking profit we start at an even split — still far above
 * TikTok (~8%) or Reels (0%), so it remains a real recruiting pitch — and raise
 * it as we scale. One constant; change it here.
 *
 * NOTE: real accrual needs impression/click tracking (engine "Phase 2"). Until
 * then this is a stated policy, not a live ledger.
 */
export const DEFAULT_CREATOR_REV_SHARE = 50

export const BUDGET_RANGES = [
  { value: 'under-500', label: 'Under $500 / month' },
  { value: '500-2k', label: '$500 – $2,000 / month' },
  { value: '2k-10k', label: '$2,000 – $10,000 / month' },
  { value: '10k-plus', label: '$10,000+ / month' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const

export type BudgetRange = (typeof BUDGET_RANGES)[number]['value']

const BUDGET_VALUES = new Set(BUDGET_RANGES.map((b) => b.value))

export type PartnerRequestInput = {
  company: string
  website: string
  contactName: string
  contactEmail: string
  promoting: string
  targetRegions?: string[]
  budgetRange?: string
  message?: string
}

/** Normalise a free-typed country list into unique 2-letter ISO codes. */
export function normalizeRegions(regions: string[] | undefined): string[] {
  if (!Array.isArray(regions)) return []
  const seen = new Set<string>()
  for (const raw of regions) {
    const code = String(raw).trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(code)) seen.add(code)
  }
  return [...seen]
}

/** Shared client/server gate. Returns an error message, or null when valid. */
export function validatePartnerRequest(input: Partial<PartnerRequestInput>): string | null {
  const req = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  if (!req(input.company)) return 'Tell us the company or brand name.'
  if (!req(input.contactName)) return 'Add a contact name.'
  if (!req(input.website)) return 'Add your website.'
  try {
    const u = new URL(input.website!.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('scheme')
  } catch {
    return 'That website doesn’t look like a valid URL (include https://).'
  }
  if (!req(input.contactEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail!.trim())) {
    return 'Add a valid contact email.'
  }
  if (!req(input.promoting)) return 'Tell us what you’d like to promote.'
  if (input.budgetRange && !BUDGET_VALUES.has(input.budgetRange as BudgetRange)) {
    return 'Pick a budget range from the list.'
  }
  return null
}
