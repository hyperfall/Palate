/**
 * A recognisable tile per retailer: initials on the shop's own colour.
 *
 * People find their supermarket by its colour before they read its name, so
 * the picker needs more than a text chip. What it deliberately does NOT use is
 * the retailers' actual logos: those are trademarks, and fetching them would
 * mean either hotlinking someone's CDN (fragile) or routing every reader
 * through a third-party favicon service (a privacy leak on every plan page).
 * A monogram in the brand's colour is unmistakably our own rendering, costs no
 * request, and can't 404.
 *
 * Colours are approximations of each brand's primary, chosen for recognition
 * and contrast against white text. Unlisted retailers fall back to a neutral
 * derived from the label, so a shop added in the admin still gets a tile.
 */

type Brand = { color: string; initials?: string }

const BRANDS: Record<string, Brand> = {
  // GB
  tesco: { color: '#00539f' },
  sainsburys: { color: '#f06c00', initials: 'Sb' },
  asda: { color: '#68a41e' },
  morrisons: { color: '#007531', initials: 'Mo' },
  waitrose: { color: '#5c8a1b', initials: 'Wr' },
  ocado: { color: '#6a2c91' },
  'aldi-gb': { color: '#00559f' },
  'lidl-gb': { color: '#0050aa' },
  'coop-gb': { color: '#00b1e7', initials: 'Co' },
  'iceland-gb': { color: '#c8102e', initials: 'Ic' },
  'amazon-fresh-uk': { color: '#ff9900', initials: 'Az' },
  // US
  walmart: { color: '#0071ce', initials: 'Wm' },
  target: { color: '#cc0000', initials: 'Tg' },
  kroger: { color: '#0d4d9e', initials: 'Kr' },
  'instacart-us': { color: '#43b02a', initials: 'In' },
  'costco-us': { color: '#005dab', initials: 'Cs' },
  'publix-us': { color: '#00833e', initials: 'Pb' },
  'safeway-us': { color: '#d3212d', initials: 'Sw' },
  'heb-us': { color: '#e01a2b', initials: 'HE' },
  'amazon-fresh-us': { color: '#ff9900', initials: 'Az' },
  // CA
  'walmart-ca': { color: '#0071ce', initials: 'Wm' },
  'loblaws-ca': { color: '#e4002b', initials: 'Lo' },
  'metro-ca': { color: '#005baa', initials: 'Mt' },
  'nofrills-ca': { color: '#fdb913', initials: 'NF' },
  'voila-ca': { color: '#e2231a', initials: 'Vo' },
  'amazon-ca': { color: '#ff9900', initials: 'Az' },
  // DE / AT / CH
  rewe: { color: '#cc071e', initials: 'Re' },
  'aldi-de': { color: '#00559f' },
  'lidl-de': { color: '#0050aa' },
  'kaufland-de': { color: '#e10915', initials: 'Kf' },
  'billa-at': { color: '#e2001a', initials: 'Bi' },
  'migros-ch': { color: '#f60002', initials: 'Mi' },
  'coop-ch': { color: '#fa6400', initials: 'Co' },
  'amazon-de': { color: '#ff9900', initials: 'Az' },
  // FR / BE
  'carrefour-fr': { color: '#004e9f', initials: 'Cf' },
  'auchan-fr': { color: '#e2001a', initials: 'Au' },
  'leclerc-fr': { color: '#0060a9', initials: 'Le' },
  'intermarche-fr': { color: '#e2001a', initials: 'Im' },
  'monoprix-fr': { color: '#e5007d', initials: 'Mp' },
  'carrefour-be': { color: '#004e9f', initials: 'Cf' },
  'amazon-fr': { color: '#ff9900', initials: 'Az' },
  // ES / PT / IT
  'carrefour-es': { color: '#004e9f', initials: 'Cf' },
  'dia-es': { color: '#e2001a', initials: 'Di' },
  mercadona: { color: '#009540', initials: 'Mc' },
  'lidl-es': { color: '#0050aa' },
  'continente-pt': { color: '#e2001a', initials: 'Ct' },
  'carrefour-it': { color: '#004e9f', initials: 'Cf' },
  'esselunga-it': { color: '#00549f', initials: 'Es' },
  'conad-it': { color: '#e2001a', initials: 'Cn' },
  'amazon-it': { color: '#ff9900', initials: 'Az' },
  // NL / Nordics
  'albert-heijn': { color: '#00a0e2', initials: 'AH' },
  'jumbo-nl': { color: '#eeb111', initials: 'Ju' },
  'ica-se': { color: '#e2001a', initials: 'IC' },
  'coop-se': { color: '#00954c', initials: 'Co' },
  'oda-no': { color: '#d4145a', initials: 'Od' },
  's-kaupat-fi': { color: '#00a0df', initials: 'SK' },
  'k-ruoka-fi': { color: '#e2001a', initials: 'KR' },
  // IE
  'tesco-ie': { color: '#00539f', initials: 'Te' },
  'supervalu-ie': { color: '#e2001a', initials: 'SV' },
  'dunnes-ie': { color: '#00447c', initials: 'Du' },
  // AU / NZ
  'woolworths-au': { color: '#178841', initials: 'Wo' },
  'coles-au': { color: '#e01a22', initials: 'Cl' },
  'aldi-au': { color: '#00559f' },
  'iga-au': { color: '#e01a22', initials: 'IG' },
  'amazon-au': { color: '#ff9900', initials: 'Az' },
  'woolworths-nz': { color: '#178841', initials: 'Wo' },
  'paknsave-nz': { color: '#ffdd00', initials: 'PS' },
  'newworld-nz': { color: '#e2001a', initials: 'NW' },
  // IN
  bigbasket: { color: '#84c225', initials: 'BB' },
  blinkit: { color: '#f8cb46', initials: 'Bl' },
  jiomart: { color: '#0f3cc9', initials: 'JM' },
  zepto: { color: '#7b2ff7', initials: 'Ze' },
  'dmart-in': { color: '#00a04a', initials: 'DM' },
  'instamart-in': { color: '#fc8019', initials: 'Sw' },
  'amazon-in': { color: '#ff9900', initials: 'Az' },
  // Asia
  'amazon-jp': { color: '#ff9900', initials: 'Az' },
  'rakuten-seiyu': { color: '#bf0000', initials: 'Ra' },
  coupang: { color: '#e52528', initials: 'Cp' },
  'ssg-kr': { color: '#ff5d00', initials: 'SS' },
  'emart-kr': { color: '#ffb100', initials: 'Em' },
  'fairprice-sg': { color: '#e2231a', initials: 'FP' },
  'cold-storage-sg': { color: '#c8102e', initials: 'CS' },
  'amazon-sg': { color: '#ff9900', initials: 'Az' },
  'parknshop-hk': { color: '#e2001a', initials: 'PS' },
  // Middle East / Türkiye
  'carrefour-ae': { color: '#004e9f', initials: 'Cf' },
  'lulu-ae': { color: '#00a651', initials: 'Lu' },
  'amazon-ae': { color: '#ff9900', initials: 'Az' },
  'carrefour-sa': { color: '#004e9f', initials: 'Cf' },
  'migros-tr': { color: '#f60002', initials: 'Mi' },
  // Americas
  'carrefour-br': { color: '#004e9f', initials: 'Cf' },
  'pao-de-acucar': { color: '#00954c', initials: 'PA' },
  'assai-br': { color: '#e2001a', initials: 'As' },
  'walmart-mx': { color: '#0071ce', initials: 'Wm' },
  'soriana-mx': { color: '#e2001a', initials: 'So' },
  'chedraui-mx': { color: '#e85b0e', initials: 'Ch' },
  'carrefour-ar': { color: '#004e9f', initials: 'Cf' },
  'coto-ar': { color: '#e2001a', initials: 'Ct' },
  'jumbo-cl': { color: '#00954c', initials: 'Ju' },
  'lider-cl': { color: '#0060a9', initials: 'Li' },
  'exito-co': { color: '#fdd000', initials: 'Ex' },
  // Africa
  'checkers-za': { color: '#c8102e', initials: 'Ck' },
  'pnp-za': { color: '#003da5', initials: 'PP' },
  'woolworths-za': { color: '#000000', initials: 'WW' },
  'woolies-food-za': { color: '#000000', initials: 'WW' },
  'shoprite-za': { color: '#e2001a', initials: 'Sh' },
  'jumia-ng': { color: '#f68b1e', initials: 'Ju' },
  'carrefour-ke': { color: '#004e9f', initials: 'Cf' },
  'carrefour-eg': { color: '#004e9f', initials: 'Cf' },
  'chaldal-bd': { color: '#00a651', initials: 'Cd' },
}

/**
 * Two letters from a label, for retailers with no entry above. A two-word name
 * gives both capitals ("Albert Heijn" → AH); one word gives title case
 * ("Tesco" → Te), matching the hand-set initials rather than shouting TE.
 */
function deriveInitials(label: string): string {
  const words = label.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  const one = label.replace(/[^\p{L}\p{N}]/gu, '')
  if (!one) return '·'
  return one[0].toUpperCase() + (one[1]?.toLowerCase() ?? '')
}

export function retailerBrand(slug: string, label: string): { color: string; initials: string } {
  const brand = BRANDS[slug]
  return {
    // A neutral slate for anything unlisted: still a tile, still scannable,
    // just not pretending to know the colour.
    color: brand?.color ?? '#5b6470',
    initials: brand?.initials ?? deriveInitials(label),
  }
}

/** Relative luminance, WCAG 2.x. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Mix a hex toward black or white by `amount` (0–1). */
function shift(hex: string, toward: 'black' | 'white', amount: number): string {
  const h = hex.replace('#', '')
  const target = toward === 'black' ? 0 : 255
  const out = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16))
    .map((c) => Math.round(c + (target - c) * amount))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
  return `#${out}`
}

const INK = '#14100c'
const AA = 4.5

/**
 * An accessible tile: the brand colour, deepened only as far as legibility
 * needs, with whichever text colour reads better on it.
 *
 * A first pass picked text by a luminance threshold and shipped orange tiles
 * with white initials at 2.4:1 — brand-accurate and unreadable. Hue carries the
 * recognition, so the fix darkens (or lightens) the swatch while keeping its
 * hue rather than abandoning the colour: Instacart stays green, just green
 * enough to read on.
 */
export function retailerTile(slug: string, label: string): { bg: string; fg: string; initials: string } {
  const { color, initials } = retailerBrand(slug, label)
  const fg = contrast(color, '#ffffff') >= contrast(color, INK) ? '#ffffff' : INK
  let bg = color
  for (let step = 0; step < 12 && contrast(bg, fg) < AA; step++) {
    bg = shift(bg, fg === '#ffffff' ? 'black' : 'white', 0.08)
  }
  return { bg, fg, initials }
}
