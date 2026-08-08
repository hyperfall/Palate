/**
 * Money, in the cook's own currency.
 *
 * The site used to price everything in GBP pence through one formatter, which
 * was fine while every number was authored by hand in London. It stops being
 * fine the moment a cook records what THEY paid: £2.50 and €2.50 and ¥250 are
 * different amounts, and a price book that forgets which one it stored is
 * worse than no price book — it produces a total that looks authoritative and
 * is silently wrong.
 *
 * So an amount is never a bare number here. It is minor units plus a currency,
 * always travelling together.
 *
 * Deliberately no exchange rates. Converting would need a live feed and would
 * put a made-up number in front of someone budgeting their week; a price the
 * cook has not given us is reported as missing instead.
 */

/**
 * The largest amount the price book will hold, matching the CHECK constraint on
 * ingredient_prices.price_minor.
 *
 * Without a ceiling, a typed "999999999999999" parsed happily into 99 trillion
 * pence: the calculator then showed absurd totals for as long as the row was on
 * screen, and the save failed at the database on a constraint the interface had
 * never mentioned. Refusing it at the point of entry is the honest place.
 */
export const MAX_MINOR = 100_000_000

/** An amount of money: minor units (pence, cents, yen) and what they are. */
export type Money = { minor: number; currency: string }

/**
 * Currencies that do not divide into 100.
 *
 * Getting this wrong is not cosmetic: treating ¥250 as 2.50 under-reports a
 * Japanese shop by a factor of a hundred. Everything absent from this table
 * has two decimal places.
 */
const MINOR_DIGITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  CLP: 0,
  ISK: 0,
  VND: 0,
  PYG: 0,
  UGX: 0,
  RWF: 0,
  XAF: 0,
  XOF: 0,
}

/**
 * Where each country the site ships shops in actually pays.
 *
 * The list tracks the countries the grocery retailers cover, because those are
 * the places a cook can already be sent to buy something — offering to price a
 * shop we can send them on, in a currency they do not use, would be the odd
 * gap.
 */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  // Eurozone
  AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR',
  LV: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR',
  // Rest of Europe
  BG: 'BGN', BY: 'BYN', CH: 'CHF', CZ: 'CZK', DK: 'DKK', GB: 'GBP', HU: 'HUF',
  NO: 'NOK', PL: 'PLN', RO: 'RON', RS: 'RSD', SE: 'SEK', TR: 'TRY', UA: 'UAH',
  // Americas
  AR: 'ARS', BR: 'BRL', CA: 'CAD', CL: 'CLP', CO: 'COP', CR: 'CRC', DO: 'DOP',
  MX: 'MXN', PE: 'PEN', PY: 'PYG', TT: 'TTD', US: 'USD', UY: 'UYU', VE: 'VES',
  // Asia-Pacific
  AU: 'AUD', BD: 'BDT', HK: 'HKD', ID: 'IDR', IN: 'INR', JP: 'JPY', KR: 'KRW',
  KZ: 'KZT', LK: 'LKR', MY: 'MYR', NZ: 'NZD', PH: 'PHP', PK: 'PKR', SG: 'SGD',
  TH: 'THB', TW: 'TWD', VN: 'VND',
  // Middle East & Africa
  AE: 'AED', EG: 'EGP', IL: 'ILS', KE: 'KES', MA: 'MAD', NG: 'NGN', QA: 'QAR',
  SA: 'SAR', ZA: 'ZAR',
}

/** What the site falls back to: the currency its authored prices are in. */
export const BASE_CURRENCY = 'GBP'

/** How many minor units make one major unit. 100 unless the table says otherwise. */
export function minorPerMajor(currency: string): number {
  return 10 ** (MINOR_DIGITS[currency.toUpperCase()] ?? 2)
}

/**
 * The currency for a country code, or the base currency for anywhere we have
 * not mapped. Case-insensitive because the edge headers are not consistent.
 */
export function currencyForCountry(code: string | null | undefined): string {
  const key = (code ?? '').trim().toUpperCase()
  return CURRENCY_BY_COUNTRY[key] ?? BASE_CURRENCY
}

/** Is this a currency the price book can store? */
export function isSupportedCurrency(code: string | null | undefined): boolean {
  const key = (code ?? '').trim().toUpperCase()
  if (key.length !== 3) return false
  return key === BASE_CURRENCY || Object.values(CURRENCY_BY_COUNTRY).includes(key)
}

/** Every currency the price book accepts, sorted, for a settings dropdown. */
export function supportedCurrencies(): string[] {
  return [...new Set([BASE_CURRENCY, ...Object.values(CURRENCY_BY_COUNTRY)])].sort()
}

/**
 * Format an amount for display: "£2.50", "€2.50", "¥250".
 *
 * The locale is pinned to en-GB for the same reason the date helpers pin
 * theirs — the currency decides the symbol and the decimal places, and the
 * grouping should not change depending on whose browser is open. Only the
 * money differs between two cooks, not the way it is written.
 */
export function formatMoney(
  minor: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (minor == null || !Number.isFinite(minor)) return null
  const code = (currency ?? BASE_CURRENCY).toUpperCase()
  const digits = MINOR_DIGITS[code] ?? 2
  const value = minor / 10 ** digits
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)
  } catch {
    // An unknown code would otherwise throw and take the panel down with it.
    return `${value.toFixed(digits)} ${code}`
  }
}

/**
 * Read what someone typed into a price field into minor units.
 *
 * Accepts what people actually type: a bare number, a leading symbol, spaces,
 * and either separator — "2.50", "£2.50", "2,50". The comma case is the one
 * that matters, because half the currencies here belong to countries that
 * write decimals that way, and parseFloat("2,50") silently returns 2.
 *
 * Returns null rather than 0 for nonsense, so a typo cannot be stored as free.
 */
export function parseMoneyInput(
  raw: string | null | undefined,
  currency: string,
): number | null {
  let s = String(raw ?? '').trim()
  if (!s) return null
  // Strip currency symbols and letters; keep digits and separators.
  s = s.replace(/[^\d.,-]/g, '')
  if (!s) return null
  // A comma used as the decimal separator: "2,50" → "2.50". Only when it is
  // the last separator and has 1–2 digits after it, so "1,250" stays 1250.
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot && /,\d{1,2}$/.test(s)) {
    s = `${s.slice(0, lastComma).replace(/[.,]/g, '')}.${s.slice(lastComma + 1)}`
  } else {
    s = s.replace(/,/g, '')
  }
  const value = Number(s)
  if (!Number.isFinite(value) || value < 0) return null
  const minor = Math.round(value * minorPerMajor(currency))
  // Out of range is a typo, not a price. Returning null puts it through the
  // same path as "cheap" or an empty box rather than inventing a number.
  if (minor > MAX_MINOR) return null
  return minor
}
