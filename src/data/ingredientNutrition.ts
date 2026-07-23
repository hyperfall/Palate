/**
 * Per-100g nutrition for the canonical ingredient set, plus a piece weight for
 * countable items and a density for volume-measured liquids. Values are
 * USDA-standard public-domain figures (SR Legacy / FoodData Central), entered
 * as a first-pass seed — treat as ESTIMATES and refine against USDA where it
 * matters. Dry goods (rice, pasta, pulses) are RAW weights, since recipes
 * specify raw quantities.
 *
 * Keyed by canonical ingredient name (lowercased). Seed with `seed:nutrition`.
 * Anything not covered here simply gets no nutrition and is skipped in the
 * recipe estimate (lowering its coverage rather than lying).
 */
export type IngNut = {
  /** per 100g */
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** avg grams for one piece — for count / no-unit quantities */
  gramsPerPiece?: number
  /** g per ml — for tsp/tbsp/ml/cup conversions (water ≈ 1) */
  densityGPerMl?: number
}

export const INGREDIENT_NUTRITION: Record<string, IngNut> = {
  // — oils & fats —
  'olive oil': { kcal: 884, protein: 0, carbs: 0, fat: 100, densityGPerMl: 0.92 },
  'sesame oil': { kcal: 884, protein: 0, carbs: 0, fat: 100, densityGPerMl: 0.92 },
  butter: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, densityGPerMl: 0.96 },
  tahini: { kcal: 595, protein: 17, carbs: 21, fat: 54, densityGPerMl: 1.05 },
  walnut: { kcal: 654, protein: 15, carbs: 14, fat: 65 },
  'sesame seed': { kcal: 573, protein: 18, carbs: 23, fat: 50 },

  // — dairy & tofu —
  'double cream': { kcal: 449, protein: 2, carbs: 3, fat: 48, densityGPerMl: 1.0 },
  'coconut milk': { kcal: 230, protein: 2.3, carbs: 6, fat: 24, densityGPerMl: 1.0 },
  feta: { kcal: 264, protein: 14, carbs: 4, fat: 21 },
  'pecorino romano': { kcal: 387, protein: 32, carbs: 0, fat: 26 },
  quesillo: { kcal: 300, protein: 20, carbs: 2, fat: 22 },
  yoghurt: { kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, densityGPerMl: 1.03 },
  'firm tofu': { kcal: 144, protein: 15, carbs: 3, fat: 9 },
  'silken tofu': { kcal: 55, protein: 5, carbs: 2, fat: 3 },

  // — proteins —
  'chicken thigh': { kcal: 209, protein: 26, carbs: 0, fat: 11 },
  'chicken stock': { kcal: 4, protein: 1, carbs: 0.5, fat: 0.2, densityGPerMl: 1.0 },
  pork: { kcal: 242, protein: 27, carbs: 0, fat: 14 },
  'pork belly': { kcal: 518, protein: 9, carbs: 0, fat: 53 },
  egg: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, gramsPerPiece: 50 },

  // — grains, pulses, starch (RAW) —
  rice: { kcal: 360, protein: 7, carbs: 80, fat: 0.6 },
  'short-grain rice': { kcal: 358, protein: 6.5, carbs: 79, fat: 0.5 },
  soba: { kcal: 348, protein: 14, carbs: 71, fat: 0.7 },
  ditalini: { kcal: 371, protein: 13, carbs: 75, fat: 1.5 },
  tonnarelli: { kcal: 371, protein: 13, carbs: 75, fat: 1.5 },
  chickpea: { kcal: 139, protein: 7, carbs: 22, fat: 2.6, gramsPerPiece: 240 },
  'refried black bean': { kcal: 130, protein: 7, carbs: 20, fat: 2 },
  cornflour: { kcal: 381, protein: 7, carbs: 91, fat: 1.5 },
  breadcrumb: { kcal: 395, protein: 13, carbs: 72, fat: 5 },
  'corn tortilla': { kcal: 218, protein: 6, carbs: 45, fat: 3, gramsPerPiece: 30 },

  // — produce —
  onion: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, gramsPerPiece: 110 },
  'white onion': { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, gramsPerPiece: 110 },
  'spring onion': { kcal: 32, protein: 1.8, carbs: 7.3, fat: 0.2, gramsPerPiece: 15 },
  garlic: { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, gramsPerPiece: 3 },
  tomato: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, gramsPerPiece: 120 },
  'cherry tomato': { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, gramsPerPiece: 17 },
  carrot: { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, gramsPerPiece: 60 },
  cucumber: { kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, gramsPerPiece: 300 },
  cabbage: { kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1 },
  spinach: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  aubergine: { kcal: 25, protein: 1, carbs: 6, fat: 0.2, gramsPerPiece: 250 },
  'thai aubergine': { kcal: 25, protein: 1, carbs: 6, fat: 0.2, gramsPerPiece: 30 },
  'red bell pepper': { kcal: 31, protein: 1, carbs: 6, fat: 0.3, gramsPerPiece: 120 },
  'red pepper': { kcal: 31, protein: 1, carbs: 6, fat: 0.3, gramsPerPiece: 120 },
  avocado: { kcal: 160, protein: 2, carbs: 9, fat: 15, gramsPerPiece: 150 },
  lemon: { kcal: 29, protein: 1.1, carbs: 9, fat: 0.3, gramsPerPiece: 60 },
  'lime juice': { kcal: 25, protein: 0.4, carbs: 8, fat: 0.1, densityGPerMl: 1.02 },
  'lime wedge': { kcal: 30, protein: 0.7, carbs: 11, fat: 0.2, gramsPerPiece: 8 },
  beansprout: { kcal: 30, protein: 3, carbs: 6, fat: 0.2 },
  'green papaya': { kcal: 43, protein: 0.5, carbs: 11, fat: 0.3 },
  'pomegranate seed': { kcal: 83, protein: 1.7, carbs: 19, fat: 1.2 },
  shiitake: { kcal: 296, protein: 10, carbs: 64, fat: 1, gramsPerPiece: 4 }, // dried, per cap
  'shiitake mushroom': { kcal: 34, protein: 2.2, carbs: 7, fat: 0.5, gramsPerPiece: 19 }, // fresh
  kimchi: { kcal: 15, protein: 1.1, carbs: 2.4, fat: 0.5 },
  'green curry paste': { kcal: 120, protein: 3, carbs: 15, fat: 5 },
  'chipotles in adobo': { kcal: 50, protein: 2, carbs: 10, fat: 1, gramsPerPiece: 15 },

  // — condiments, sauces, sweeteners (sugars often measured by volume) —
  'soy sauce': { kcal: 53, protein: 8, carbs: 5, fat: 0.6, densityGPerMl: 1.15 },
  'fish sauce': { kcal: 35, protein: 5, carbs: 4, fat: 0, densityGPerMl: 1.2 },
  gochujang: { kcal: 200, protein: 5, carbs: 45, fat: 1 },
  doubanjiang: { kcal: 150, protein: 6, carbs: 20, fat: 4 },
  'chilli crisp': { kcal: 450, protein: 5, carbs: 20, fat: 40, densityGPerMl: 0.95 },
  mirin: { kcal: 258, protein: 0.2, carbs: 43, fat: 0, densityGPerMl: 1.1 },
  'chinkiang black vinegar': { kcal: 20, protein: 0.5, carbs: 4, fat: 0, densityGPerMl: 1.05 },
  passata: { kcal: 35, protein: 1.5, carbs: 7, fat: 0.2, densityGPerMl: 1.04 },
  'tomato pur e': { kcal: 82, protein: 4.3, carbs: 19, fat: 0.5, densityGPerMl: 1.07 },
  salsa: { kcal: 36, protein: 1.5, carbs: 7, fat: 0.2, densityGPerMl: 1.03 },
  'pomegranate molasses': { kcal: 280, protein: 0.4, carbs: 70, fat: 0, densityGPerMl: 1.3 },
  honey: { kcal: 304, protein: 0.3, carbs: 82, fat: 0, densityGPerMl: 1.42 },
  sugar: { kcal: 387, protein: 0, carbs: 100, fat: 0, densityGPerMl: 0.85 },
  'palm sugar': { kcal: 380, protein: 0, carbs: 98, fat: 0 },
  dashi: { kcal: 5, protein: 0.5, carbs: 0.5, fat: 0, densityGPerMl: 1.0 },
  kombu: { kcal: 43, protein: 6, carbs: 9, fat: 0.6 },
  wasabi: { kcal: 292, protein: 4.8, carbs: 63, fat: 0.6 },
  'refried black bean ': { kcal: 130, protein: 7, carbs: 20, fat: 2 },

  // — spices, herbs, salt, water (used in small amounts; contribution is minor) —
  cumin: { kcal: 375, protein: 18, carbs: 44, fat: 22 },
  'garam masala': { kcal: 379, protein: 15, carbs: 45, fat: 15 },
  'tandoori masala': { kcal: 300, protein: 12, carbs: 45, fat: 8 },
  'kashmiri chilli powder': { kcal: 282, protein: 12, carbs: 50, fat: 14 },
  'cayenne pepper': { kcal: 318, protein: 12, carbs: 57, fat: 17 },
  'sweet paprika': { kcal: 282, protein: 14, carbs: 54, fat: 13 },
  gochugaru: { kcal: 282, protein: 12, carbs: 57, fat: 8 },
  'aleppo pepper': { kcal: 300, protein: 12, carbs: 55, fat: 12 },
  'sichuan peppercorn': { kcal: 264, protein: 10, carbs: 60, fat: 6 },
  'black peppercorn': { kcal: 251, protein: 10, carbs: 64, fat: 3 },
  amchur: { kcal: 310, protein: 3, carbs: 75, fat: 1 },
  'fenugreek leave': { kcal: 49, protein: 4.4, carbs: 6, fat: 0.9 },
  cilantro: { kcal: 23, protein: 2.1, carbs: 3.7, fat: 0.5 },
  'flat-leaf parsley': { kcal: 36, protein: 3, carbs: 6, fat: 0.8 },
  'thai basil': { kcal: 23, protein: 3.2, carbs: 2.7, fat: 0.6 },
  rosemary: { kcal: 131, protein: 3.3, carbs: 21, fat: 6 },
  'kaffir lime leave': { kcal: 40, protein: 3, carbs: 8, fat: 0.5 },
  salt: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  water: { kcal: 0, protein: 0, carbs: 0, fat: 0, densityGPerMl: 1.0 },
}
