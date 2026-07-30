/**
 * Every ISO-3166 alpha-2 country code, for the shop-country picker.
 *
 * The site carries 208 cuisines, so the picker must not pretend a country
 * doesn't exist just because no retailer covers it yet: a Comorian picks
 * Comoros and gets the honest copy-list fallback, not a menu that skips their
 * home. Names come from Intl.DisplayNames at render, so this stays a flat
 * code list rather than a translation table.
 */
export const ALL_COUNTRY_CODES: readonly string[] =
  ('AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ ' +
    'CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM ' +
    'FO FR GA GB GD GE GF GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS ' +
    'IT JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG ' +
    'MH MK ML MM MN MO MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG ' +
    'PH PK PL PR PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ ' +
    'TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VC VE VN VU WS YE ZA ZM ZW').split(' ')
