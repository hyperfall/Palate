import { describe, expect, it } from 'vitest'

import { DAILY_REFERENCE_INTAKES, computeNutrition, trafficLight, parseQuantity, toGrams, type NutritionRow } from '@/lib/nutrition'

describe('parseQuantity', () => {
  it('reads integers and decimals', () => {
    expect(parseQuantity('400')).toBe(400)
    expect(parseQuantity('1.5')).toBe(1.5)
    expect(parseQuantity('2 large')).toBe(2)
  })
  it('reads fractions, mixed, unicode, and ranges', () => {
    expect(parseQuantity('1/2')).toBe(0.5)
    expect(parseQuantity('1 1/2')).toBe(1.5)
    expect(parseQuantity('½')).toBe(0.5)
    expect(parseQuantity('1½')).toBe(1.5)
    expect(parseQuantity('2-3')).toBe(2.5)
    expect(parseQuantity('2 to 4')).toBe(3)
  })
  it('returns null for non-numeric or empty', () => {
    expect(parseQuantity('a pinch')).toBeNull()
    expect(parseQuantity('to taste')).toBeNull()
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity(null)).toBeNull()
  })
})

describe('toGrams', () => {
  const oil = { densityGPerMl: 0.92 }
  it('converts weight units directly', () => {
    expect(toGrams(200, 'g', {})).toBe(200)
    expect(toGrams(1, 'kg', {})).toBe(1000)
    expect(toGrams(1, 'oz', {})).toBeCloseTo(28.35, 1)
  })
  it('converts volume via density (default 1 when absent)', () => {
    expect(toGrams(2, 'tbsp', oil)).toBeCloseTo(27.6, 1) // 2*15*0.92
    expect(toGrams(1, 'cup', {})).toBe(240) // density defaults to 1
    expect(toGrams(1, 'ml', {})).toBe(1)
  })
  it('converts count/no-unit via gramsPerPiece, else null', () => {
    expect(toGrams(3, '', { gramsPerPiece: 50 })).toBe(150) // 3 eggs
    expect(toGrams(2, 'clove', { gramsPerPiece: 3 })).toBe(6)
    expect(toGrams(2, '', {})).toBeNull() // no piece weight → unpriceable
    expect(toGrams(3, 'cm', { gramsPerPiece: 5 })).toBeNull() // length unit → null
  })
})

describe('computeNutrition', () => {
  const rows: NutritionRow[] = [
    { quantity: '2', unit: 'tbsp', ingredient: { densityGPerMl: 0.92, nutrition: { kcalPer100g: 884, fatPer100g: 100 } } },
    { quantity: '3', unit: '', ingredient: { gramsPerPiece: 50, nutrition: { kcalPer100g: 143, proteinPer100g: 12.6, carbsPer100g: 0.7, fatPer100g: 9.5 } } },
    { quantity: '200', unit: 'g', ingredient: { nutrition: { kcalPer100g: 40, proteinPer100g: 1.1, carbsPer100g: 9.3 } } },
  ]

  it('sums grams × per-100g and divides by servings', () => {
    const r = computeNutrition(rows, 2)
    expect(r.perServing).toEqual({
      calories: 269,
      protein: 11,
      carbs: 10,
      fat: 21,
      saturates: null,
      sugars: null,
      fibre: null,
      salt: null,
    })
    expect(r.coverage).toBe(1)
    expect(r.usable).toBe(3)
  })

  it('reports partial coverage and skips unpriceable rows', () => {
    const partial: NutritionRow[] = [
      ...rows,
      { quantity: 'a pinch', unit: '', ingredient: { nutrition: { kcalPer100g: 300 } } }, // no qty
      { quantity: '1', unit: '', ingredient: { nutrition: { kcalPer100g: 50 } } }, // no piece weight
      { quantity: '2', unit: 'g', ingredient: {} }, // no nutrition data
    ]
    const r = computeNutrition(partial, 2)
    // "a pinch" has no amount, so it's excluded from the denominator entirely;
    // the two other rows state amounts but can't be priced.
    expect(r.total).toBe(5)
    expect(r.usable).toBe(3)
    expect(r.coverage).toBeCloseTo(0.6, 5)
  })

  it('treats zero/blank servings as 1', () => {
    const r = computeNutrition([{ quantity: '100', unit: 'g', ingredient: { nutrition: { kcalPer100g: 100 } } }], 0)
    expect(r.perServing.calories).toBe(100)
  })
})

describe('UK front-of-pack extensions', () => {
  it('sums saturates/sugars/fibre/salt and reports serving grams', () => {
    const r = computeNutrition(
      [
        {
          quantity: '200',
          unit: 'g',
          ingredient: {
            nutrition: { kcalPer100g: 100, saturatesPer100g: 5, sugarsPer100g: 10, fibrePer100g: 2, saltPer100g: 0.5 },
          },
        },
      ],
      2,
    )
    expect(r.servingGrams).toBe(100)
    expect(r.perServing.saturates).toBe(5)
    expect(r.perServing.sugars).toBe(10)
    expect(r.perServing.fibre).toBe(2)
    expect(r.perServing.salt).toBe(0.5) // 2dp survives — integer rounding would erase it
  })

  it('reports null, not 0, when no ingredient carried a field', () => {
    const r = computeNutrition(
      [{ quantity: '100', unit: 'g', ingredient: { nutrition: { kcalPer100g: 100 } } }],
      1,
    )
    expect(r.perServing.saturates).toBeNull()
    expect(r.perServing.salt).toBeNull()
  })

  it('scores FSA traffic lights on the per-100g boundaries', () => {
    expect(trafficLight('fat', 3)).toBe('green') // boundary is inclusive-green
    expect(trafficLight('fat', 10)).toBe('amber')
    expect(trafficLight('fat', 17.6)).toBe('red')
    expect(trafficLight('saturates', 1.5)).toBe('green')
    expect(trafficLight('saturates', 5.1)).toBe('red')
    expect(trafficLight('sugars', 22.5)).toBe('amber') // > red threshold only
    expect(trafficLight('salt', 0.3)).toBe('green')
    expect(trafficLight('salt', 1.51)).toBe('red')
  })

  it('carries the daily reference intakes a label compares against', () => {
    expect(DAILY_REFERENCE_INTAKES.calories).toBe(2000)
    expect(DAILY_REFERENCE_INTAKES.salt).toBe(6)
  })
})
