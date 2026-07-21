/**
 * Sample content for local development.
 *
 * ⚠️  NOT the launch catalog. Design spec §3 requires 30–50 hero recipes that a
 * human has cooked, verified, and edited before publishing — that is a content
 * operation and explicitly cannot be satisfied by code. These sixteen exist so
 * the catalog, facets, gauges, pagination, and brand slots can be exercised
 * against realistic shapes. Replace them before launch.
 */

import type { Course, MainIngredient } from '../lib/taxonomy'

export type SeedRecipe = {
  title: string
  cuisine: string
  course: Course
  mainIngredient: MainIngredient
  spiciness: number
  sweetness: number
  richness: number
  effort: number
  dietaryTags: string[]
  prepMinutes: number
  cookMinutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  servings: number
  story?: string
  palette: [string, string]
  ingredients: Array<{ quantity?: string; unit?: string; item: string; note?: string }>
  steps: Array<{ text: string; timerSeconds?: number }>
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number }
}

export const SEED_CUISINES = [
  {
    name: 'Korean',
    region: 'east-asia',
    flagEmoji: '🇰🇷',
    description:
      'Fermentation doing the heavy lifting. Kimchi, gochujang, doenjang — time is the first ingredient.',
    palette: ['#8a2f1f', '#c2412a'] as [string, string],
  },
  {
    name: 'Japanese',
    region: 'east-asia',
    flagEmoji: '🇯🇵',
    description:
      'Restraint as a technique. Dashi, soy, and mirin in careful proportion — nothing to hide behind.',
    palette: ['#3c4450', '#7a8494'] as [string, string],
  },
  {
    name: 'Indian',
    region: 'south-asia',
    flagEmoji: '🇮🇳',
    description:
      'Spices bloomed in fat until the kitchen changes its mind about what food smells like.',
    palette: ['#8a5a1e', '#c98a2e'] as [string, string],
  },
  {
    name: 'Chinese',
    region: 'east-asia',
    flagEmoji: '🇨🇳',
    description:
      'Wok hei, doubanjiang, numbing peppercorn. Heat here has a texture, not just a temperature.',
    palette: ['#5c2b22', '#a83b25'] as [string, string],
  },
  {
    name: 'Mexican',
    region: 'latin-america',
    flagEmoji: '🇲🇽',
    description:
      'Chillies toasted until they smell of chocolate and smoke. Patience is an ingredient.',
    palette: ['#6b3a24', '#b06a2c'] as [string, string],
  },
  {
    name: 'Thai',
    region: 'southeast-asia',
    flagEmoji: '🇹🇭',
    description:
      'Built on the balance of four things at once — hot, sour, salty, sweet. Nothing dominates for long.',
    palette: ['#7d3b2e', '#c2412a'] as [string, string],
  },
  {
    name: 'Italian',
    region: 'southern-europe',
    flagEmoji: '🇮🇹',
    description: 'Few ingredients, ruthlessly chosen. The discipline is in what gets left out.',
    palette: ['#4a5138', '#8a9160'] as [string, string],
  },
  {
    name: 'Levantine',
    region: 'middle-east',
    flagEmoji: '🫒',
    description:
      'Lemon, olive oil, herbs by the handful. Food designed to sit on a table for hours.',
    palette: ['#5d6b38', '#9aa86a'] as [string, string],
  },
]

/**
 * Cuisine slugs from earlier seeds that no longer exist in the taxonomy.
 * Sichuan folded into Chinese, Oaxacan into Mexican, Neapolitan into Italian
 * so the hubs match how a visitor actually browses. The seed deletes these
 * after recipes have been re-pointed.
 */
export const RETIRED_CUISINE_SLUGS = ['sichuan', 'oaxacan', 'neapolitan']

export const SEED_AUTHORS = [
  {
    name: 'Sample Kitchen',
    bio: 'Placeholder author attached to seeded development content. Replace with real, named cooks before launch — §3 makes human verification mandatory.',
    provenanceDefault: 'authored' as const,
  },
]

export const SEED_RECIPES: SeedRecipe[] = [
  // ── Korean ────────────────────────────────────────────────────────────────
  {
    title: 'Kimchi Jjigae',
    cuisine: 'Korean',
    course: 'dinner',
    mainIngredient: 'pork',
    spiciness: 4,
    sweetness: 1,
    richness: 3,
    effort: 1,
    dietaryTags: [],
    prepMinutes: 10,
    cookMinutes: 25,
    difficulty: 'easy',
    servings: 2,
    story:
      'The stew that justifies letting kimchi go past its prime. Older and sourer is better here — fresh kimchi makes a thin, polite jjigae.',
    palette: ['#7a2417', '#c2412a'],
    ingredients: [
      { quantity: '300', unit: 'g', item: 'ripe kimchi', note: 'roughly chopped, juice reserved' },
      { quantity: '150', unit: 'g', item: 'pork belly', note: 'sliced thin' },
      { quantity: '1', unit: 'tbsp', item: 'gochujang' },
      { quantity: '1', unit: 'tsp', item: 'gochugaru' },
      { quantity: '400', unit: 'ml', item: 'water', note: 'or anchovy stock' },
      { quantity: '200', unit: 'g', item: 'firm tofu', note: 'thick slices' },
      { quantity: '2', item: 'spring onions', note: 'cut long' },
    ],
    steps: [
      { text: 'Render the pork belly in the bottom of the pot until the fat runs and the edges brown.', timerSeconds: 240 },
      { text: 'Add the kimchi and fry it hard in the pork fat. This step is the difference between stew and soup.', timerSeconds: 300 },
      { text: 'Stir in gochujang and gochugaru, then pour in the water and the reserved kimchi juice.' },
      { text: 'Simmer, uncovered, until the broth turns brick red and slightly thick.', timerSeconds: 900 },
      { text: 'Slide in the tofu and cook five minutes more. Finish with spring onion, serve bubbling.', timerSeconds: 300 },
    ],
    nutrition: { calories: 420, protein: 25, carbs: 14, fat: 30 },
  },
  {
    title: 'Bibimbap with Gochujang Sauce',
    cuisine: 'Korean',
    course: 'dinner',
    mainIngredient: 'rice-grains',
    spiciness: 2,
    sweetness: 2,
    richness: 2,
    effort: 3,
    dietaryTags: ['vegetarian'],
    prepMinutes: 30,
    cookMinutes: 15,
    difficulty: 'medium',
    servings: 2,
    story:
      'Each vegetable is seasoned alone so the bowl has five distinct tastes, not one beige average. The crust at the bottom is not a mistake.',
    palette: ['#8a5a1e', '#b0722a'],
    ingredients: [
      { quantity: '300', unit: 'g', item: 'short-grain rice', note: 'cooked and kept hot' },
      { quantity: '150', unit: 'g', item: 'spinach', note: 'blanched, squeezed dry' },
      { quantity: '1', item: 'carrot', note: 'matchsticks' },
      { quantity: '150', unit: 'g', item: 'beansprouts' },
      { quantity: '4', item: 'shiitake mushrooms', note: 'sliced' },
      { quantity: '2', item: 'eggs' },
      { quantity: '2', unit: 'tbsp', item: 'gochujang' },
      { quantity: '1', unit: 'tbsp', item: 'sesame oil' },
      { quantity: '1', unit: 'tsp', item: 'sugar' },
    ],
    steps: [
      { text: 'Season each vegetable separately — spinach with sesame oil and salt, sprouts with garlic, carrot and shiitake fried in turn.', timerSeconds: 600 },
      { text: 'Loosen the gochujang with sesame oil, sugar, and a spoon of water into a pourable sauce.' },
      { text: 'Press the hot rice into a heavy bowl (stone if you have one) and let it sit over low heat until it crackles.', timerSeconds: 300 },
      { text: 'Arrange the vegetables in wedges over the rice, keeping the colours separate.' },
      { text: 'Fry the eggs sunny side up and slide them on top. Sauce over everything, then break the yolk and mix violently at the table.' },
    ],
    nutrition: { calories: 560, protein: 20, carbs: 82, fat: 16 },
  },

  // ── Japanese ──────────────────────────────────────────────────────────────
  {
    title: 'Oyakodon',
    cuisine: 'Japanese',
    course: 'dinner',
    mainIngredient: 'chicken',
    spiciness: 0,
    sweetness: 3,
    richness: 3,
    effort: 1,
    dietaryTags: [],
    prepMinutes: 10,
    cookMinutes: 15,
    difficulty: 'easy',
    servings: 2,
    story:
      'Chicken and egg over rice, cooked in one small pan in fifteen minutes. The egg goes in twice — that is the whole secret.',
    palette: ['#8a6a2e', '#c9a44a'],
    ingredients: [
      { quantity: '2', item: 'chicken thighs', note: 'boneless, bite-size pieces' },
      { quantity: '1', item: 'onion', note: 'sliced with the grain' },
      { quantity: '4', item: 'eggs', note: 'barely beaten — streaky, not uniform' },
      { quantity: '200', unit: 'ml', item: 'dashi' },
      { quantity: '2', unit: 'tbsp', item: 'soy sauce' },
      { quantity: '2', unit: 'tbsp', item: 'mirin' },
      { quantity: '1', unit: 'tsp', item: 'sugar' },
      { quantity: '300', unit: 'g', item: 'cooked rice', note: 'hot' },
    ],
    steps: [
      { text: 'Simmer the dashi, soy, mirin, and sugar in a small frying pan; add the onion and soften it.', timerSeconds: 300 },
      { text: 'Add the chicken and simmer until just cooked through.', timerSeconds: 420 },
      { text: 'Pour on two-thirds of the egg in a spiral, cover, and cook until barely set.', timerSeconds: 90 },
      { text: 'Add the rest of the egg, kill the heat, cover for thirty seconds — it should still tremble.', timerSeconds: 30 },
      { text: 'Slide the whole pan over hot rice in one motion.' },
    ],
    nutrition: { calories: 640, protein: 42, carbs: 68, fat: 20 },
  },
  {
    title: 'Chilled Soba with Kombu Tsuyu',
    cuisine: 'Japanese',
    course: 'lunch',
    mainIngredient: 'pasta-noodles',
    spiciness: 0,
    sweetness: 1,
    richness: 0,
    effort: 1,
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free'],
    prepMinutes: 10,
    cookMinutes: 10,
    difficulty: 'easy',
    servings: 2,
    story: 'The dish for a day too hot to cook. All the work is in rinsing the noodles properly.',
    palette: ['#4a5158', '#8a929c'],
    ingredients: [
      { quantity: '200', unit: 'g', item: 'dried soba' },
      { quantity: '10', unit: 'cm', item: 'kombu' },
      { quantity: '3', item: 'dried shiitake' },
      { quantity: '3', unit: 'tbsp', item: 'soy sauce' },
      { quantity: '2', unit: 'tbsp', item: 'mirin' },
      { item: 'spring onion', note: 'sliced fine' },
      { item: 'wasabi', note: 'to taste' },
    ],
    steps: [
      { text: 'Steep the kombu and shiitake in 250 ml cold water for at least an hour — overnight is better.', timerSeconds: 3600 },
      { text: 'Warm the steeping liquid with soy and mirin, then chill it hard.', timerSeconds: 300 },
      { text: 'Boil the soba by its packet timing, not your instinct.', timerSeconds: 300 },
      { text: 'Rinse the noodles under cold running water, rubbing until the water runs clear and they squeak.' },
      { text: 'Serve noodles and ice-cold tsuyu separately. Dip, slurp, repeat.' },
    ],
    nutrition: { calories: 380, protein: 14, carbs: 78, fat: 2 },
  },

  // ── Indian ────────────────────────────────────────────────────────────────
  {
    title: 'Chana Masala',
    cuisine: 'Indian',
    course: 'dinner',
    mainIngredient: 'legumes',
    spiciness: 3,
    sweetness: 1,
    richness: 2,
    effort: 1,
    dietaryTags: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'],
    prepMinutes: 10,
    cookMinutes: 30,
    difficulty: 'easy',
    servings: 4,
    story:
      'Tinned chickpeas are fine. What is not negotiable is blooming the spices in hot fat — raw spice powder in liquid never comes back from it.',
    palette: ['#7a4a1a', '#b0722a'],
    ingredients: [
      { quantity: '2', unit: 'tins', item: 'chickpeas', note: 'drained' },
      { quantity: '2', item: 'onions', note: 'diced fine' },
      { quantity: '4', item: 'garlic cloves', note: 'grated with a thumb of ginger' },
      { quantity: '2', unit: 'tsp', item: 'garam masala' },
      { quantity: '1', unit: 'tsp', item: 'ground cumin' },
      { quantity: '1', unit: 'tsp', item: 'Kashmiri chilli powder' },
      { quantity: '400', unit: 'g', item: 'chopped tomatoes' },
      { quantity: '1', unit: 'tsp', item: 'amchur', note: 'or a hard squeeze of lemon' },
    ],
    steps: [
      { text: 'Fry the onions in generous oil past golden, to the edge of catching.', timerSeconds: 600 },
      { text: 'Add garlic-ginger and cook until the raw smell is gone.', timerSeconds: 90 },
      { text: 'Drop the heat, add all the spices, and bloom them in the fat for thirty seconds.', timerSeconds: 30 },
      { text: 'Tomatoes in. Cook until the oil separates and stains the surface — do not shortcut this.', timerSeconds: 480 },
      { text: 'Chickpeas and a mug of water. Simmer to a thick gravy, crushing a few against the pot.', timerSeconds: 600 },
      { text: 'Finish with amchur or lemon. It should bite back a little.' },
    ],
    nutrition: { calories: 340, protein: 14, carbs: 48, fat: 11 },
  },
  {
    title: 'Butter Chicken',
    cuisine: 'Indian',
    course: 'dinner',
    mainIngredient: 'chicken',
    spiciness: 2,
    sweetness: 3,
    richness: 5,
    effort: 3,
    dietaryTags: ['gluten-free'],
    prepMinutes: 20,
    cookMinutes: 40,
    difficulty: 'medium',
    servings: 4,
    story:
      'Char the chicken properly under a fierce grill — the smoke flavour is the dish. The sauce is just there to be luxurious about it.',
    palette: ['#8a3a1a', '#c2662a'],
    ingredients: [
      { quantity: '600', unit: 'g', item: 'chicken thighs', note: 'boneless' },
      { quantity: '150', unit: 'g', item: 'yoghurt', note: 'for the marinade' },
      { quantity: '2', unit: 'tbsp', item: 'tandoori masala' },
      { quantity: '500', unit: 'g', item: 'passata' },
      { quantity: '60', unit: 'g', item: 'butter' },
      { quantity: '100', unit: 'ml', item: 'double cream' },
      { quantity: '1', unit: 'tbsp', item: 'honey' },
      { quantity: '1', unit: 'tsp', item: 'dried fenugreek leaves', note: 'kasuri methi, crushed' },
    ],
    steps: [
      { text: 'Marinate the chicken in yoghurt and tandoori masala — an hour minimum, overnight for real depth.', timerSeconds: 3600 },
      { text: 'Grill the chicken under the fiercest heat you have until charred at the edges but not cooked through.', timerSeconds: 480 },
      { text: 'Simmer the passata with the butter until it loses its raw edge.', timerSeconds: 600 },
      { text: 'Add the chicken and its juices; finish cooking it in the sauce.', timerSeconds: 480 },
      { text: 'Cream, honey, and kasuri methi crushed between your palms. Simmer two minutes, no more.', timerSeconds: 120 },
    ],
    nutrition: { calories: 620, protein: 38, carbs: 18, fat: 44 },
  },

  // ── Chinese ───────────────────────────────────────────────────────────────
  {
    title: 'Mapo Tofu',
    cuisine: 'Chinese',
    course: 'dinner',
    mainIngredient: 'tofu-tempeh',
    spiciness: 5,
    sweetness: 0,
    richness: 4,
    effort: 2,
    dietaryTags: [],
    prepMinutes: 10,
    cookMinutes: 15,
    difficulty: 'medium',
    servings: 3,
    story:
      'Numbing and hot are two different sensations and this dish needs both. If your peppercorns do not tingle, they are old.',
    palette: ['#7a2b1e', '#c2412a'],
    ingredients: [
      { quantity: '400', unit: 'g', item: 'silken tofu', note: 'cut into 2cm cubes' },
      { quantity: '2', unit: 'tbsp', item: 'doubanjiang', note: 'fermented broad bean paste' },
      { quantity: '150', unit: 'g', item: 'minced pork' },
      { quantity: '1', unit: 'tsp', item: 'ground Sichuan peppercorn' },
      { quantity: '250', unit: 'ml', item: 'chicken stock' },
      { quantity: '1', unit: 'tbsp', item: 'cornflour', note: 'slaked in cold water' },
      { item: 'spring onions', note: 'sliced thin' },
    ],
    steps: [
      { text: 'Slide the tofu into salted simmering water and leave it there while you cook everything else. It firms up and seasons from the inside.' },
      { text: 'Brown the pork hard in a dry wok until the fat renders and the edges catch.', timerSeconds: 240 },
      { text: 'Add the doubanjiang and fry until the oil turns properly red.', timerSeconds: 90 },
      { text: 'Pour in the stock, then lift the tofu in with a slotted spoon. Do not stir — push.' },
      { text: 'Thicken with the slaked cornflour in three additions, letting it come back to a simmer each time.' },
      { text: 'Off the heat, scatter the ground peppercorn and spring onion over the top.' },
    ],
    nutrition: { calories: 380, protein: 24, carbs: 12, fat: 27 },
  },
  {
    title: 'Smashed Cucumber Salad',
    cuisine: 'Chinese',
    course: 'side',
    mainIngredient: 'vegetables',
    spiciness: 2,
    sweetness: 1,
    richness: 1,
    effort: 0,
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free'],
    prepMinutes: 10,
    cookMinutes: 0,
    difficulty: 'easy',
    servings: 2,
    story: 'Smashing beats slicing: the ragged edges drink the dressing. Ten minutes, one bowl.',
    palette: ['#3f5c2e', '#7ba050'],
    ingredients: [
      { quantity: '2', item: 'cucumbers' },
      { quantity: '2', item: 'garlic cloves', note: 'minced' },
      { quantity: '2', unit: 'tbsp', item: 'chinkiang black vinegar' },
      { quantity: '1', unit: 'tbsp', item: 'soy sauce' },
      { quantity: '1', unit: 'tbsp', item: 'chilli crisp' },
      { quantity: '1', unit: 'tsp', item: 'sugar' },
      { quantity: '1', unit: 'tsp', item: 'toasted sesame seeds' },
    ],
    steps: [
      { text: 'Lay the flat of a knife on each cucumber and hit it until the cucumber splits along its length. Tear into chunks.' },
      { text: 'Salt the pieces and let them weep in a colander for ten minutes, then drain.', timerSeconds: 600 },
      { text: 'Whisk garlic, vinegar, soy, sugar, and chilli crisp into a dressing.' },
      { text: 'Toss, scatter with sesame, and eat cold. Better within the hour; soggy by tomorrow.' },
    ],
    nutrition: { calories: 90, protein: 3, carbs: 12, fat: 4 },
  },

  // ── Mexican ───────────────────────────────────────────────────────────────
  {
    title: 'Tacos de Tinga',
    cuisine: 'Mexican',
    course: 'dinner',
    mainIngredient: 'chicken',
    spiciness: 3,
    sweetness: 2,
    richness: 2,
    effort: 2,
    dietaryTags: ['dairy-free'],
    prepMinutes: 15,
    cookMinutes: 30,
    difficulty: 'easy',
    servings: 4,
    story:
      'Chipotle in adobo does the smoky work. Shred the chicken with your hands, not a machine — texture is half the dish.',
    palette: ['#7a3018', '#b85c2a'],
    ingredients: [
      { quantity: '500', unit: 'g', item: 'chicken thighs', note: 'poached and shredded' },
      { quantity: '2', item: 'onions', note: 'one for poaching, one sliced' },
      { quantity: '3', item: 'chipotles in adobo', note: 'plus a spoon of the sauce' },
      { quantity: '400', unit: 'g', item: 'chopped tomatoes' },
      { quantity: '12', item: 'corn tortillas' },
      { item: 'white onion and coriander', note: 'chopped, to serve' },
      { item: 'lime wedges' },
    ],
    steps: [
      { text: 'Poach the chicken with half an onion and a bay leaf until just done; shred it by hand.', timerSeconds: 900 },
      { text: 'Fry the sliced onion until soft and sweet.', timerSeconds: 300 },
      { text: 'Blend tomatoes with the chipotles and adobo; pour over the onions and simmer until darkened.', timerSeconds: 480 },
      { text: 'Fold in the chicken and a ladle of poaching broth; cook until the sauce clings.', timerSeconds: 300 },
      { text: 'Warm the tortillas over a flame. Fill, top with raw onion and coriander, squeeze lime, eat standing up.' },
    ],
    nutrition: { calories: 480, protein: 34, carbs: 46, fat: 17 },
  },
  {
    title: 'Black Bean Tlayuda',
    cuisine: 'Mexican',
    course: 'dinner',
    mainIngredient: 'legumes',
    spiciness: 3,
    sweetness: 1,
    richness: 3,
    effort: 2,
    dietaryTags: ['vegetarian'],
    prepMinutes: 15,
    cookMinutes: 20,
    difficulty: 'medium',
    servings: 2,
    palette: ['#5e3722', '#a86a2c'],
    ingredients: [
      { quantity: '2', item: 'large corn tortillas', note: 'the biggest you can find' },
      { quantity: '200', unit: 'g', item: 'refried black beans' },
      { quantity: '100', unit: 'g', item: 'quesillo', note: 'or mozzarella, pulled into strands' },
      { quantity: '1', item: 'avocado', note: 'sliced' },
      { item: 'cabbage', note: 'shredded fine' },
      { item: 'salsa', note: 'to taste' },
    ],
    steps: [
      { text: 'Toast the tortillas dry on a comal until they stiffen and blister but stay pliable.', timerSeconds: 180 },
      { text: 'Spread the beans thinly right to the edge — thick beans steam the base and you lose the crunch.' },
      { text: 'Scatter the cheese and return to the heat until it slumps.', timerSeconds: 120 },
      { text: 'Top with cabbage and avocado off the heat so they stay cold against the hot base.' },
      { text: 'Fold once and eat immediately, over a plate.' },
    ],
    nutrition: { calories: 610, protein: 22, carbs: 58, fat: 32 },
  },

  // ── Thai ──────────────────────────────────────────────────────────────────
  {
    title: 'Green Curry with Aubergine and Thai Basil',
    cuisine: 'Thai',
    course: 'dinner',
    mainIngredient: 'vegetables',
    spiciness: 4,
    sweetness: 2,
    richness: 4,
    effort: 2,
    dietaryTags: ['gluten-free', 'dairy-free'],
    prepMinutes: 15,
    cookMinutes: 20,
    difficulty: 'easy',
    servings: 4,
    story:
      'The paste is where the work is. Buy a good one and this is a weeknight dish; make your own and it becomes a weekend one. Both are correct.',
    palette: ['#2f4a35', '#6f9160'],
    ingredients: [
      { quantity: '3', unit: 'tbsp', item: 'green curry paste' },
      { quantity: '400', unit: 'ml', item: 'coconut milk', note: 'full fat, not light' },
      { quantity: '2', item: 'Thai aubergines', note: 'quartered' },
      { quantity: '1', unit: 'tbsp', item: 'fish sauce' },
      { quantity: '1', unit: 'tsp', item: 'palm sugar' },
      { item: 'Thai basil', note: 'a large handful, leaves picked' },
      { quantity: '2', item: 'kaffir lime leaves', note: 'torn' },
    ],
    steps: [
      { text: 'Split the coconut milk: heat the thick top third in a wide pan over medium until it separates and the oil comes out. This is the step people skip and it is the one that matters.', timerSeconds: 300 },
      { text: 'Fry the curry paste in that oil until it smells of nothing but itself.', timerSeconds: 120 },
      { text: 'Add the remaining coconut milk, the aubergine, and the lime leaves. Simmer until the aubergine gives to a spoon.', timerSeconds: 600 },
      { text: 'Season with fish sauce and palm sugar. Taste. Adjust. Taste again.' },
      { text: 'Kill the heat, fold through the basil, and serve before it wilts entirely.' },
    ],
    nutrition: { calories: 420, protein: 8, carbs: 18, fat: 36 },
  },
  {
    title: 'Som Tam',
    cuisine: 'Thai',
    course: 'side',
    mainIngredient: 'vegetables',
    spiciness: 5,
    sweetness: 3,
    richness: 0,
    effort: 1,
    dietaryTags: ['gluten-free', 'dairy-free'],
    prepMinutes: 20,
    cookMinutes: 0,
    difficulty: 'easy',
    servings: 2,
    story: 'A salad that is really a percussion exercise. Bruise, do not blend.',
    palette: ['#4a6b38', '#9ab060'],
    ingredients: [
      { quantity: '1', item: 'green papaya', note: 'shredded' },
      { quantity: '4', item: 'bird’s eye chillies' },
      { quantity: '2', item: 'garlic cloves' },
      { quantity: '2', unit: 'tbsp', item: 'fish sauce' },
      { quantity: '2', unit: 'tbsp', item: 'lime juice' },
      { quantity: '1', unit: 'tbsp', item: 'palm sugar' },
      { quantity: '10', item: 'cherry tomatoes', note: 'halved' },
    ],
    steps: [
      { text: 'Pound the garlic and chilli in a mortar to a coarse paste — coarse, not smooth.' },
      { text: 'Add the palm sugar and work it in until it dissolves.' },
      { text: 'Add the tomatoes and bruise them just enough to release their liquid.' },
      { text: 'Add the papaya and pound while turning with a spoon, so it softens without shredding to mush.' },
      { text: 'Season with fish sauce and lime. It should be aggressive — it is meant to be eaten with plain rice.' },
    ],
    nutrition: { calories: 150, protein: 3, carbs: 32, fat: 1 },
  },

  // ── Italian ───────────────────────────────────────────────────────────────
  {
    title: 'Cacio e Pepe',
    cuisine: 'Italian',
    course: 'dinner',
    mainIngredient: 'pasta-noodles',
    spiciness: 2,
    sweetness: 0,
    richness: 4,
    effort: 3,
    dietaryTags: ['vegetarian'],
    prepMinutes: 5,
    cookMinutes: 12,
    difficulty: 'hard',
    servings: 2,
    story:
      'Three ingredients and nowhere to hide. The failure mode is a stringy clump, and the cause is always heat.',
    palette: ['#5c5a4a', '#a9a48a'],
    ingredients: [
      { quantity: '200', unit: 'g', item: 'tonnarelli', note: 'or spaghetti' },
      { quantity: '100', unit: 'g', item: 'pecorino romano', note: 'finely grated' },
      { quantity: '1', unit: 'tbsp', item: 'black peppercorns', note: 'coarsely cracked' },
    ],
    steps: [
      { text: 'Toast the cracked pepper in a dry pan until it becomes fragrant.', timerSeconds: 60 },
      { text: 'Cook the pasta in the smallest amount of water that will cover it, so the water turns properly starchy.', timerSeconds: 480 },
      { text: 'Make a paste of the pecorino with a little cool pasta water. Cool, not hot — hot water is what makes it seize.' },
      { text: 'Take the pan fully off the heat. Combine pasta, pepper, and cheese paste, tossing hard and adding water until it turns glossy.' },
      { text: 'Serve at once. It waits for no one.' },
    ],
    nutrition: { calories: 560, protein: 24, carbs: 72, fat: 20 },
  },
  {
    title: 'Pasta e Ceci',
    cuisine: 'Italian',
    course: 'dinner',
    mainIngredient: 'pasta-noodles',
    spiciness: 1,
    sweetness: 1,
    richness: 2,
    effort: 1,
    dietaryTags: ['vegetarian', 'dairy-free'],
    prepMinutes: 5,
    cookMinutes: 30,
    difficulty: 'easy',
    servings: 4,
    story: 'Store-cupboard cooking that tastes like it took a great deal more from you than it did.',
    palette: ['#6b6238', '#b5a86a'],
    ingredients: [
      { quantity: '2', unit: 'tins', item: 'chickpeas', note: 'drained, liquid kept' },
      { quantity: '200', unit: 'g', item: 'ditalini', note: 'or any small pasta' },
      { quantity: '3', item: 'garlic cloves', note: 'sliced' },
      { quantity: '1', unit: 'sprig', item: 'rosemary' },
      { quantity: '2', unit: 'tbsp', item: 'tomato purée' },
      { item: 'olive oil', note: 'generously' },
    ],
    steps: [
      { text: 'Warm the garlic and rosemary in olive oil until fragrant but nowhere near coloured.', timerSeconds: 180 },
      { text: 'Blitz half the chickpeas with their liquid into a rough purée. This is what makes it creamy without cream.' },
      { text: 'Stir in the tomato purée and cook it out for a minute.' },
      { text: 'Add both the whole and blended chickpeas, plus water to cover. Simmer.', timerSeconds: 600 },
      { text: 'Cook the pasta directly in the pot so the starch stays where you want it.', timerSeconds: 540 },
      { text: 'Rest off the heat for five minutes before serving. It thickens as it sits.', timerSeconds: 300 },
    ],
    nutrition: { calories: 460, protein: 17, carbs: 68, fat: 13 },
  },

  // ── Levantine ─────────────────────────────────────────────────────────────
  {
    title: 'Charred Aubergine with Tahini and Pomegranate',
    cuisine: 'Levantine',
    course: 'side',
    mainIngredient: 'vegetables',
    spiciness: 0,
    sweetness: 2,
    richness: 3,
    effort: 1,
    dietaryTags: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'],
    prepMinutes: 10,
    cookMinutes: 25,
    difficulty: 'easy',
    servings: 4,
    palette: ['#4a4f38', '#8f9a66'],
    ingredients: [
      { quantity: '2', item: 'large aubergines' },
      { quantity: '4', unit: 'tbsp', item: 'tahini', note: 'the runny kind' },
      { quantity: '1', item: 'lemon', note: 'juiced' },
      { quantity: '1', item: 'garlic clove', note: 'grated to a paste' },
      { item: 'pomegranate seeds' },
      { item: 'flat-leaf parsley', note: 'roughly chopped' },
    ],
    steps: [
      { text: 'Blacken the aubergines directly over a flame or under a hot grill, turning until the skin collapses everywhere.', timerSeconds: 1200 },
      { text: 'Rest them in a colander so the bitter liquid drains away.', timerSeconds: 600 },
      { text: 'Whisk the tahini with lemon and garlic. It will seize, then loosen — keep adding cold water until it turns pale and pourable.' },
      { text: 'Tear the aubergine flesh into a shallow bowl. Do not chop it; the ragged edges hold the sauce.' },
      { text: 'Spoon over the tahini, then the pomegranate and parsley.' },
    ],
    nutrition: { calories: 240, protein: 6, carbs: 18, fat: 17 },
  },
  {
    title: 'Muhammara',
    cuisine: 'Levantine',
    course: 'snack',
    mainIngredient: 'vegetables',
    spiciness: 3,
    sweetness: 3,
    richness: 3,
    effort: 1,
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free'],
    prepMinutes: 15,
    cookMinutes: 0,
    difficulty: 'easy',
    servings: 6,
    palette: ['#7a3224', '#bd5a33'],
    ingredients: [
      { quantity: '3', item: 'roasted red peppers', note: 'drained well' },
      { quantity: '100', unit: 'g', item: 'walnuts', note: 'toasted' },
      { quantity: '2', unit: 'tbsp', item: 'pomegranate molasses' },
      { quantity: '1', unit: 'tsp', item: 'Aleppo pepper' },
      { quantity: '40', unit: 'g', item: 'breadcrumbs' },
      { quantity: '1', unit: 'tbsp', item: 'olive oil' },
    ],
    steps: [
      { text: 'Dry the peppers properly on kitchen paper. Wet peppers make a loose, sad dip.' },
      { text: 'Pulse the walnuts and breadcrumbs to a coarse rubble — texture is the whole point.' },
      { text: 'Add the peppers, molasses, and Aleppo pepper. Pulse again, briefly.' },
      { text: 'Loosen with olive oil and season. Rest an hour before eating; it is better warm than cold.' },
    ],
    nutrition: { calories: 210, protein: 5, carbs: 14, fat: 16 },
  },
]

export const SEED_BRAND_CARDS = [
  {
    brand: 'Maldon',
    tagline: 'The flake that finishes it. Pyramid crystals, still hand-harvested in Essex.',
    ctaLabel: 'Find a stockist',
    ctaUrl: 'https://example.com/partner/maldon',
    weight: 2,
    targetRegions: ['GB', 'IE'],
    assignedCuisines: ['Italian', 'Levantine', 'Japanese'],
    palette: ['#3f4652', '#8d95a3'] as [string, string],
  },
  {
    brand: 'Diaspora Co.',
    tagline: 'Single-origin turmeric and peppercorn, paid for at four times the commodity rate.',
    ctaLabel: 'Shop spices',
    ctaUrl: 'https://example.com/partner/diaspora',
    weight: 1,
    targetRegions: [],
    assignedCuisines: ['Thai', 'Chinese', 'Indian', 'Korean'],
    palette: ['#8a5a1e', '#d0a04a'] as [string, string],
  },
  {
    brand: 'Netherton Foundry',
    tagline: 'Spun iron pans, made in Shropshire. Heavy enough to hold heat through a hard sear.',
    ctaLabel: 'See the range',
    ctaUrl: 'https://example.com/partner/netherton',
    weight: 1,
    targetRegions: ['GB'],
    assignedCuisines: ['Chinese', 'Mexican', 'Korean', 'Italian'],
    palette: ['#3a3a38', '#7d7c76'] as [string, string],
  },
]
