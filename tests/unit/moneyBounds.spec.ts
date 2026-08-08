import { describe, expect, it } from 'vitest'
import { computeCost, type PriceBook } from '@/lib/cost'
import { formatMoney, minorPerMajor, parseMoneyInput } from '@/lib/money'
import { emptyCosting, emptyItem, parseCosting, toCostInput, unitPrice } from '@/lib/costing'
import { computeShopping } from '@/lib/shopping'

const bad = (label: string, v: unknown) => {
  const n = typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n)) return `${label}: NOT FINITE (${String(v)})`
  if (n < 0) return `${label}: NEGATIVE (${n})`
  if (Math.abs(n) > 1e12) return `${label}: ABSURD (${n})`
  return null
}
const problems: string[] = []
const check = (label: string, v: unknown) => { const p = bad(label, v); if (p) problems.push(p) }

/**
 * Hostile input against the money and costing libraries.
 *
 * These handle money, they are the newest code on the site, and every one of
 * them is reachable from a text field a stranger can type into. The assertions
 * are deliberately broad — nothing may come back non-finite, negative, or
 * absurd — because the interesting failures here are not wrong-by-a-penny, they
 * are NaN reaching the screen and a price of ninety-nine trillion reaching the
 * database.
 *
 * Written after a structured audit found exactly three of those.
 */
describe('adversarial probe', () => {
  it('computeCost survives hostile servings', () => {
    const book: PriceBook = new Map([['x', { priceMinor: 250, currency: 'GBP', packAmount: 500, packUnit: 'g' }]])
    const rows = [{ quantity: '200', unit: 'g', item: 'x', ingredient: { slug: 'x' } }]
    for (const s of [0, -1, -100, 0.5, NaN, Infinity, 1e9]) {
      const r = computeCost(rows, s as number, book, 'GBP')
      check(`servings=${s} perServing`, r.perServingMinor)
      check(`servings=${s} total`, r.totalMinor)
    }
  })

  it('computeCost survives hostile pack sizes and prices', () => {
    for (const [price, pack] of [[250, 0.0001], [1e9, 1], [0, 500], [250, 1e9]]) {
      const book: PriceBook = new Map([['x', { priceMinor: price, currency: 'GBP', packAmount: pack, packUnit: 'g' }]])
      const r = computeCost([{ quantity: '200', unit: 'g', item: 'x', ingredient: { slug: 'x' } }], 4, book, 'GBP')
      check(`price=${price} pack=${pack} total`, r.totalMinor)
    }
  })

  it('computeCost survives hostile quantities', () => {
    const book: PriceBook = new Map([['x', { priceMinor: 250, currency: 'GBP', packAmount: 500, packUnit: 'g' }]])
    for (const q of ['999999999999', '1e9', '-5', '0', '1/0', '.5', '1.2.3', '½']) {
      const r = computeCost([{ quantity: q, unit: 'g', item: 'x', ingredient: { slug: 'x' } }], 4, book, 'GBP')
      if (r.lines[0].minor != null) check(`qty=${q}`, r.lines[0].minor)
    }
  })

  it('shopping never invents a negative leftover or infinite pack count', () => {
    const c = { ...emptyCosting('GBP'), servings: 4, items: [
      { ...emptyItem('x','x'), priceMinor: 250, packAmount: 500, packUnit: 'g' as const, useAmount: '1200', useUnit: 'g' },
      { ...emptyItem('y','y'), priceMinor: 1, packAmount: 0.001, packUnit: 'g' as const, useAmount: '1000', useUnit: 'g' },
    ]}
    const { rows, prices } = toCostInput(c, () => null)
    const res = computeCost(rows, 4, prices, 'GBP')
    const sh = computeShopping(c, res)
    check('shoppingMinor', sh.shoppingMinor)
    check('leftoverMinor', sh.leftoverMinor)
    check('secondTimeMinor', sh.secondTimeMinor)
    for (const l of sh.lines) { check(`packs ${l.item}`, l.packs); check(`shop ${l.item}`, l.shopMinor) }
  })

  it('money parsing refuses to produce nonsense', () => {
    for (const s of ['1e9', '999999999999999', '0.001', '--5', '1,2,3', '£', '.', '1e-9', 'Infinity']) {
      const v = parseMoneyInput(s, 'GBP')
      if (v !== null) check(`parseMoneyInput(${s})`, v)
    }
    for (const c of ['GBP','JPY','gbp','ZZZ']) check(`minorPerMajor(${c})`, minorPerMajor(c))
  })

  it('unitPrice never divides by zero', () => {
    for (const pack of [0, -1, 0.0000001, NaN as unknown as number]) {
      const u = unitPrice({ ...emptyItem('x','x'), priceMinor: 250, packAmount: pack, packUnit: 'g' })
      if (u) check(`unitPrice pack=${pack}`, u.minor)
    }
  })

  it('parseCosting survives garbage', () => {
    for (const g of [{}, {items:'no'}, {items:[1,2,3]}, {servings:NaN}, {currency:123}, {items:[{label:'x',priceMinor:'abc'}]}]) {
      const c = parseCosting(g)
      if (c) { check('parsed servings', c.servings); expect(Array.isArray(c.items)).toBe(true) }
    }
  })

  it('reports everything it found', () => {
    if (problems.length) console.log('\nPROBLEMS:\n' + problems.map(p => '  ' + p).join('\n'))
    expect(problems).toEqual([])
  })
})
