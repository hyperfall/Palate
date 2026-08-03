import { describe, expect, it } from 'vitest'

import {
  BASE_CURRENCY,
  currencyForCountry,
  formatMoney,
  isSupportedCurrency,
  minorPerMajor,
  parseMoneyInput,
  supportedCurrencies,
} from '@/lib/money'

describe('minor units', () => {
  it('divides most currencies into hundredths', () => {
    expect(minorPerMajor('GBP')).toBe(100)
    expect(minorPerMajor('EUR')).toBe(100)
    expect(minorPerMajor('INR')).toBe(100)
  })

  it('knows the currencies that do not subdivide', () => {
    // ¥250 is two hundred and fifty yen, not two yen fifty. Getting this wrong
    // under-reports a Japanese shop by a factor of a hundred.
    expect(minorPerMajor('JPY')).toBe(1)
    expect(minorPerMajor('KRW')).toBe(1)
    expect(minorPerMajor('CLP')).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(minorPerMajor('jpy')).toBe(1)
  })
})

describe('currency for a country', () => {
  it('maps the eurozone to one currency', () => {
    for (const c of ['DE', 'FR', 'IE', 'ES', 'PT']) {
      expect(currencyForCountry(c)).toBe('EUR')
    }
  })

  it('maps countries that keep their own', () => {
    expect(currencyForCountry('GB')).toBe('GBP')
    expect(currencyForCountry('US')).toBe('USD')
    expect(currencyForCountry('JP')).toBe('JPY')
    expect(currencyForCountry('IN')).toBe('INR')
    expect(currencyForCountry('PL')).toBe('PLN')
  })

  it('tolerates the shapes edge headers actually send', () => {
    expect(currencyForCountry('gb')).toBe('GBP')
    expect(currencyForCountry(' de ')).toBe('EUR')
  })

  it('falls back to the base currency for anywhere unmapped', () => {
    expect(currencyForCountry(null)).toBe(BASE_CURRENCY)
    expect(currencyForCountry('')).toBe(BASE_CURRENCY)
    expect(currencyForCountry('ZZ')).toBe(BASE_CURRENCY)
  })
})

describe('supported currencies', () => {
  it('accepts what the country map can produce', () => {
    for (const code of supportedCurrencies()) {
      expect(isSupportedCurrency(code)).toBe(true)
    }
  })

  it('rejects nonsense that must never reach the price book', () => {
    expect(isSupportedCurrency('POUNDS')).toBe(false)
    expect(isSupportedCurrency('')).toBe(false)
    expect(isSupportedCurrency(null)).toBe(false)
    expect(isSupportedCurrency('XYZ')).toBe(false)
  })

  it('always includes the base currency', () => {
    expect(supportedCurrencies()).toContain(BASE_CURRENCY)
  })
})

describe('formatting', () => {
  it('writes the symbol and the right number of decimals', () => {
    expect(formatMoney(250, 'GBP')).toBe('£2.50')
    expect(formatMoney(57, 'GBP')).toBe('£0.57')
  })

  it('writes zero-decimal currencies whole', () => {
    // "JP¥250", not "¥250": en-GB qualifies symbols that several currencies
    // share, and that is worth keeping rather than forcing narrowSymbol. In a
    // product where one household prices in dollars and another in dollars, a
    // bare "$" is the ambiguity, not the fix.
    expect(formatMoney(250, 'JPY')).toMatch(/^\D*250$/)
    expect(formatMoney(250, 'JPY')).not.toMatch(/250[.,]/)
    expect(formatMoney(3000, 'KRW')).toMatch(/3,000/)
  })

  it('distinguishes currencies that share a symbol', () => {
    expect(formatMoney(250, 'USD')).not.toBe(formatMoney(250, 'CAD'))
    expect(formatMoney(250, 'USD')).not.toBe(formatMoney(250, 'AUD'))
  })

  it('returns null rather than a number for missing amounts', () => {
    // A cost panel has to be able to say "we don't know" — rendering £0.00 for
    // an unpriced ingredient is the failure this whole feature exists to fix.
    expect(formatMoney(null, 'GBP')).toBeNull()
    expect(formatMoney(undefined, 'GBP')).toBeNull()
    expect(formatMoney(Number.NaN, 'GBP')).toBeNull()
  })

  it('survives an unknown currency instead of throwing', () => {
    // Intl throws on a bad code; a bad row in the database must not take the
    // whole recipe page down.
    expect(formatMoney(250, 'ZZZ')).toContain('ZZZ')
  })
})

describe('reading a typed price', () => {
  it('reads a plain amount', () => {
    expect(parseMoneyInput('2.50', 'GBP')).toBe(250)
    expect(parseMoneyInput('2', 'GBP')).toBe(200)
  })

  it('ignores a currency symbol someone typed anyway', () => {
    expect(parseMoneyInput('£2.50', 'GBP')).toBe(250)
    expect(parseMoneyInput('€ 2.50', 'EUR')).toBe(250)
  })

  it('reads a comma as the decimal separator', () => {
    // Half the currencies here belong to countries that write it this way, and
    // parseFloat("2,50") silently returns 2 — a 96% discount.
    expect(parseMoneyInput('2,50', 'EUR')).toBe(250)
  })

  it('reads a comma as a thousands separator when it is one', () => {
    expect(parseMoneyInput('1,250', 'JPY')).toBe(1250)
    expect(parseMoneyInput('1,250.75', 'GBP')).toBe(125075)
  })

  it('scales by the currency, not by a fixed 100', () => {
    expect(parseMoneyInput('250', 'JPY')).toBe(250)
    expect(parseMoneyInput('250', 'GBP')).toBe(25000)
  })

  it('rounds to whole minor units', () => {
    expect(parseMoneyInput('2.505', 'GBP')).toBe(251)
  })

  it('refuses nonsense instead of storing it as free', () => {
    expect(parseMoneyInput('', 'GBP')).toBeNull()
    expect(parseMoneyInput('   ', 'GBP')).toBeNull()
    expect(parseMoneyInput('cheap', 'GBP')).toBeNull()
    expect(parseMoneyInput('-3', 'GBP')).toBeNull()
    expect(parseMoneyInput(null, 'GBP')).toBeNull()
  })
})
