import { describe, expect, it } from 'vitest'
import { convertMeasure, humanizeQuantity, convertTemperatures } from '@/lib/units'

describe('convertMeasure', () => {
  it('converts US volume/weight to metric', () => {
    expect(convertMeasure(1, 'cup', 'metric')).toEqual({ quantity: 240, unit: 'ml' })
    expect(convertMeasure(8, 'oz', 'metric')).toEqual({ quantity: 224, unit: 'g' })
    expect(convertMeasure(2, 'lb', 'metric')).toEqual({ quantity: 908, unit: 'g' })
  })
  it('converts metric weight/volume to US', () => {
    expect(convertMeasure(500, 'g', 'us')).toEqual({ quantity: 1.1, unit: 'lb' })
    expect(convertMeasure(240, 'ml', 'us')).toEqual({ quantity: 1, unit: 'cup' })
  })
  it('promotes to the larger unit past a threshold', () => {
    expect(convertMeasure(4, 'cup', 'metric')).toEqual({ quantity: 960, unit: 'ml' })
    expect(convertMeasure(1500, 'g', 'us').unit).toBe('lb')
  })
  it('leaves universal and unknown units untouched', () => {
    for (const u of ['tbsp', 'tsp', 'clove', 'pinch', 'can', 'sprig']) {
      expect(convertMeasure(2, u, 'metric')).toEqual({ quantity: 2, unit: u })
    }
  })
  it('leaves a unit already in the target system untouched', () => {
    expect(convertMeasure(200, 'g', 'metric')).toEqual({ quantity: 200, unit: 'g' })
    expect(convertMeasure(1, 'cup', 'us')).toEqual({ quantity: 1, unit: 'cup' })
  })
})

describe('humanizeQuantity', () => {
  it('snaps to vulgar fractions', () => {
    expect(humanizeQuantity(0.5)).toBe('½')
    expect(humanizeQuantity(1.75)).toBe('1¾')
    expect(humanizeQuantity(2)).toBe('2')
  })
  it('never shows a fractional count for a countable ingredient', () => {
    expect(humanizeQuantity(1.33, { countable: true })).toBe('1')
    expect(humanizeQuantity(2.6, { countable: true })).toBe('3')
    expect(humanizeQuantity(0.4, { countable: true })).toBe('1') // never rounds a real ingredient to zero
  })
  it('rounds messy decimals to two places', () => {
    expect(humanizeQuantity(0.333)).toBe('⅓')
    expect(humanizeQuantity(1.42)).toBe('1.42')
  })
})

describe('convertTemperatures', () => {
  it('rewrites oven temps to the target system', () => {
    expect(convertTemperatures('Bake at 350°F until golden.', 'metric')).toBe('Bake at 175°C until golden.')
    expect(convertTemperatures('Roast at 200°C.', 'us')).toBe('Roast at 390°F.')
  })
  it('handles a space before the degree and bare F/C', () => {
    expect(convertTemperatures('Heat to 425 F.', 'metric')).toBe('Heat to 220°C.')
  })
  it('leaves text with no temperature unchanged', () => {
    expect(convertTemperatures('Simmer for 10 minutes.', 'metric')).toBe('Simmer for 10 minutes.')
  })
})

describe('US weights are readable on a scale', () => {
  it('shows a decimal for weight, never a vulgar third', () => {
    // 300 g read as "10⅔ oz" — a gradation no kitchen scale has.
    const oz = convertMeasure(300, 'g', 'us')
    expect(oz.unit).toBe('oz')
    expect(humanizeQuantity(oz.quantity, { unit: oz.unit })).toBe('10.7')
  })

  it('keeps precision on pounds rather than snapping to quarters', () => {
    const lb = convertMeasure(500, 'g', 'us')
    expect(lb).toEqual({ quantity: 1.1, unit: 'lb' })
    expect(humanizeQuantity(lb.quantity, { unit: lb.unit })).toBe('1.1')
  })

  it('still gives fractions to cups, where the jug is marked in them', () => {
    expect(humanizeQuantity(0.33, { unit: 'cup' })).toBe('⅓')
    expect(humanizeQuantity(1.5, { unit: 'tbsp' })).toBe('1½')
  })
})
