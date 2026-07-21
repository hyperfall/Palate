import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { slugify } from '../fields/slug'

/**
 * Seeds a cuisine hub for every country's kitchen — the whole world, small
 * nations included. Idempotent: existing hubs (by slug) are never touched,
 * so the curated 27 keep their descriptions and photos. New hubs start
 * empty; the cuisines index already hides zero-recipe hubs, so breadth here
 * costs nothing visually until recipes arrive.
 *
 *   npm run seed:cuisines
 */

type Region =
  | 'east-asia' | 'south-asia' | 'southeast-asia' | 'middle-east' | 'africa'
  | 'northern-europe' | 'southern-europe' | 'eastern-europe'
  | 'north-america' | 'latin-america' | 'caribbean' | 'oceania' | 'cross-regional'

/** [cuisine name (demonym), ISO-3166 alpha-2 for the flag, region] */
const WORLD: Array<[string, string, Region]> = [
  // East Asia
  ['Japanese', 'JP', 'east-asia'], ['Korean', 'KR', 'east-asia'], ['Chinese', 'CN', 'east-asia'],
  ['Taiwanese', 'TW', 'east-asia'], ['Mongolian', 'MN', 'east-asia'], ['Hong Kong', 'HK', 'east-asia'],
  ['North Korean', 'KP', 'east-asia'], ['Macanese', 'MO', 'east-asia'],
  // South Asia
  ['Indian', 'IN', 'south-asia'], ['Pakistani', 'PK', 'south-asia'], ['Bangladeshi', 'BD', 'south-asia'],
  ['Sri Lankan', 'LK', 'south-asia'], ['Nepali', 'NP', 'south-asia'], ['Bhutanese', 'BT', 'south-asia'],
  ['Maldivian', 'MV', 'south-asia'], ['Afghan', 'AF', 'south-asia'],
  // Southeast Asia
  ['Thai', 'TH', 'southeast-asia'], ['Vietnamese', 'VN', 'southeast-asia'], ['Filipino', 'PH', 'southeast-asia'],
  ['Indonesian', 'ID', 'southeast-asia'], ['Malaysian', 'MY', 'southeast-asia'], ['Singaporean', 'SG', 'southeast-asia'],
  ['Burmese', 'MM', 'southeast-asia'], ['Cambodian', 'KH', 'southeast-asia'], ['Lao', 'LA', 'southeast-asia'],
  ['Bruneian', 'BN', 'southeast-asia'], ['Timorese', 'TL', 'southeast-asia'],
  // Middle East & Central Asia
  ['Levantine', 'LB', 'middle-east'], ['Turkish', 'TR', 'middle-east'], ['Iranian', 'IR', 'middle-east'],
  ['Iraqi', 'IQ', 'middle-east'], ['Israeli', 'IL', 'middle-east'], ['Palestinian', 'PS', 'middle-east'],
  ['Jordanian', 'JO', 'middle-east'], ['Syrian', 'SY', 'middle-east'], ['Saudi', 'SA', 'middle-east'],
  ['Yemeni', 'YE', 'middle-east'], ['Omani', 'OM', 'middle-east'], ['Emirati', 'AE', 'middle-east'],
  ['Qatari', 'QA', 'middle-east'], ['Kuwaiti', 'KW', 'middle-east'], ['Bahraini', 'BH', 'middle-east'],
  ['Armenian', 'AM', 'middle-east'], ['Azerbaijani', 'AZ', 'middle-east'], ['Georgian', 'GE', 'middle-east'],
  ['Kazakh', 'KZ', 'middle-east'], ['Uzbek', 'UZ', 'middle-east'], ['Turkmen', 'TM', 'middle-east'],
  ['Kyrgyz', 'KG', 'middle-east'], ['Tajik', 'TJ', 'middle-east'],
  // Africa
  ['Moroccan', 'MA', 'africa'], ['Algerian', 'DZ', 'africa'], ['Tunisian', 'TN', 'africa'],
  ['Libyan', 'LY', 'africa'], ['Egyptian', 'EG', 'africa'], ['Sudanese', 'SD', 'africa'],
  ['Ethiopian', 'ET', 'africa'], ['Eritrean', 'ER', 'africa'], ['Somali', 'SO', 'africa'],
  ['Kenyan', 'KE', 'africa'], ['Tanzanian', 'TZ', 'africa'], ['Ugandan', 'UG', 'africa'],
  ['Rwandan', 'RW', 'africa'], ['Burundian', 'BI', 'africa'], ['Congolese', 'CD', 'africa'],
  ['Nigerian', 'NG', 'africa'], ['Ghanaian', 'GH', 'africa'], ['Senegalese', 'SN', 'africa'],
  ['Malian', 'ML', 'africa'], ['Ivorian', 'CI', 'africa'], ['Cameroonian', 'CM', 'africa'],
  ['Beninese', 'BJ', 'africa'], ['Togolese', 'TG', 'africa'], ['Burkinabe', 'BF', 'africa'],
  ['Nigerien', 'NE', 'africa'], ['Chadian', 'TD', 'africa'], ['Gambian', 'GM', 'africa'],
  ['Guinean', 'GN', 'africa'], ['Bissau-Guinean', 'GW', 'africa'], ['Sierra Leonean', 'SL', 'africa'],
  ['Liberian', 'LR', 'africa'], ['Mauritanian', 'MR', 'africa'], ['Cape Verdean', 'CV', 'africa'],
  ['South African', 'ZA', 'africa'], ['Namibian', 'NA', 'africa'], ['Botswanan', 'BW', 'africa'],
  ['Zimbabwean', 'ZW', 'africa'], ['Zambian', 'ZM', 'africa'], ['Malawian', 'MW', 'africa'],
  ['Mozambican', 'MZ', 'africa'], ['Angolan', 'AO', 'africa'], ['Gabonese', 'GA', 'africa'],
  ['Equatoguinean', 'GQ', 'africa'], ['Central African', 'CF', 'africa'], ['South Sudanese', 'SS', 'africa'],
  ['Djiboutian', 'DJ', 'africa'], ['Malagasy', 'MG', 'africa'], ['Mauritian', 'MU', 'africa'],
  ['Seychellois', 'SC', 'africa'], ['Comorian', 'KM', 'africa'], ['Basotho', 'LS', 'africa'],
  ['Swazi', 'SZ', 'africa'], ['Sao Tomean', 'ST', 'africa'],
  // Northern Europe
  ['British', 'GB', 'northern-europe'], ['Irish', 'IE', 'northern-europe'], ['German', 'DE', 'northern-europe'],
  ['Dutch', 'NL', 'northern-europe'], ['Belgian', 'BE', 'northern-europe'], ['Luxembourgish', 'LU', 'northern-europe'],
  ['Danish', 'DK', 'northern-europe'], ['Swedish', 'SE', 'northern-europe'], ['Norwegian', 'NO', 'northern-europe'],
  ['Finnish', 'FI', 'northern-europe'], ['Icelandic', 'IS', 'northern-europe'], ['Estonian', 'EE', 'northern-europe'],
  ['Latvian', 'LV', 'northern-europe'], ['Lithuanian', 'LT', 'northern-europe'], ['Swiss', 'CH', 'northern-europe'],
  ['Austrian', 'AT', 'northern-europe'],
  // Southern Europe
  ['French', 'FR', 'southern-europe'], ['Italian', 'IT', 'southern-europe'], ['Spanish', 'ES', 'southern-europe'],
  ['Portuguese', 'PT', 'southern-europe'], ['Greek', 'GR', 'southern-europe'], ['Maltese', 'MT', 'southern-europe'],
  ['Cypriot', 'CY', 'southern-europe'], ['Andorran', 'AD', 'southern-europe'], ['Monegasque', 'MC', 'southern-europe'],
  ['Sammarinese', 'SM', 'southern-europe'],
  // Eastern Europe
  ['Polish', 'PL', 'eastern-europe'], ['Czech', 'CZ', 'eastern-europe'], ['Slovak', 'SK', 'eastern-europe'],
  ['Hungarian', 'HU', 'eastern-europe'], ['Romanian', 'RO', 'eastern-europe'], ['Bulgarian', 'BG', 'eastern-europe'],
  ['Ukrainian', 'UA', 'eastern-europe'], ['Belarusian', 'BY', 'eastern-europe'], ['Russian', 'RU', 'eastern-europe'],
  ['Moldovan', 'MD', 'eastern-europe'], ['Serbian', 'RS', 'eastern-europe'], ['Croatian', 'HR', 'eastern-europe'],
  ['Bosnian', 'BA', 'eastern-europe'], ['Slovenian', 'SI', 'eastern-europe'], ['Macedonian', 'MK', 'eastern-europe'],
  ['Albanian', 'AL', 'eastern-europe'], ['Montenegrin', 'ME', 'eastern-europe'], ['Kosovar', 'XK', 'eastern-europe'],
  // North America
  ['American', 'US', 'north-america'], ['Canadian', 'CA', 'north-america'],
  // Latin America
  ['Mexican', 'MX', 'latin-america'], ['Guatemalan', 'GT', 'latin-america'], ['Salvadoran', 'SV', 'latin-america'],
  ['Honduran', 'HN', 'latin-america'], ['Nicaraguan', 'NI', 'latin-america'], ['Costa Rican', 'CR', 'latin-america'],
  ['Panamanian', 'PA', 'latin-america'], ['Colombian', 'CO', 'latin-america'], ['Venezuelan', 'VE', 'latin-america'],
  ['Ecuadorian', 'EC', 'latin-america'], ['Peruvian', 'PE', 'latin-america'], ['Bolivian', 'BO', 'latin-america'],
  ['Chilean', 'CL', 'latin-america'], ['Argentine', 'AR', 'latin-america'], ['Uruguayan', 'UY', 'latin-america'],
  ['Paraguayan', 'PY', 'latin-america'], ['Brazilian', 'BR', 'latin-america'], ['Guyanese', 'GY', 'latin-america'],
  ['Surinamese', 'SR', 'latin-america'], ['Belizean', 'BZ', 'latin-america'],
  // Caribbean
  ['Cuban', 'CU', 'caribbean'], ['Jamaican', 'JM', 'caribbean'], ['Haitian', 'HT', 'caribbean'],
  ['Dominican', 'DO', 'caribbean'], ['Puerto Rican', 'PR', 'caribbean'], ['Trinidadian', 'TT', 'caribbean'],
  ['Bahamian', 'BS', 'caribbean'], ['Barbadian', 'BB', 'caribbean'], ['Saint Lucian', 'LC', 'caribbean'],
  ['Grenadian', 'GD', 'caribbean'], ['Antiguan', 'AG', 'caribbean'], ['Kittitian', 'KN', 'caribbean'],
  ['Vincentian', 'VC', 'caribbean'], ['Dominica', 'DM', 'caribbean'],
  // Oceania
  ['Australian', 'AU', 'oceania'], ['New Zealand', 'NZ', 'oceania'], ['Fijian', 'FJ', 'oceania'],
  ['Papua New Guinean', 'PG', 'oceania'], ['Samoan', 'WS', 'oceania'], ['Tongan', 'TO', 'oceania'],
  ['Solomon Islander', 'SB', 'oceania'], ['Vanuatuan', 'VU', 'oceania'], ['Palauan', 'PW', 'oceania'],
  ['Micronesian', 'FM', 'oceania'], ['Marshallese', 'MH', 'oceania'], ['Kiribati', 'KI', 'oceania'],
  ['Nauruan', 'NR', 'oceania'], ['Tuvaluan', 'TV', 'oceania'],
]

/** ISO alpha-2 → flag emoji via regional indicator symbols. */
function flag(iso2: string): string {
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

const payload = await getPayload({ config })

let created = 0
let skipped = 0
for (const [name, iso2, region] of WORLD) {
  const slug = slugify(name)
  const existing = await payload.find({
    collection: 'cuisines',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (existing.docs[0]) {
    skipped++
    continue
  }
  await payload.create({
    collection: 'cuisines',
    data: { name, slug, region, flagEmoji: flag(iso2) },
  })
  created++
}

console.log(`World cuisines — ${created} created, ${skipped} already existed.`)
console.log('Zero-recipe hubs stay hidden on /cuisines until recipes arrive.')
process.exit(0)
