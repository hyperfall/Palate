/**
 * The viewer's chosen country, shared by every control that can set it.
 *
 * Two places now offer the choice — the footer, and the shop panel on a plan —
 * so the value cannot live inside either. It sits in localStorage under one
 * key, and changes are announced so an open page updates instead of waiting
 * for a reload: picking a country in the footer while looking at a shopping
 * list should change the shops in front of you.
 *
 * Deliberately not a cookie. A cookie would be sent with every request and
 * would force the pages that read it out of the static cache; the country only
 * matters to client-side filtering, and the edge header already proposes a
 * default for the server render.
 */

export const SHOP_COUNTRY_KEY = 'palate:shop-country'

/** Same-tab notification; `storage` only fires in OTHER tabs. */
const CHANGE_EVENT = 'palate:shop-country-change'

export function readShopCountry(): string | null {
  try {
    return window.localStorage.getItem(SHOP_COUNTRY_KEY)
  } catch {
    return null
  }
}

/** Passing null forgets the choice, falling back to whatever was detected. */
export function writeShopCountry(code: string | null): void {
  try {
    if (code) window.localStorage.setItem(SHOP_COUNTRY_KEY, code)
    else window.localStorage.removeItem(SHOP_COUNTRY_KEY)
  } catch {
    /* storage unavailable — the change still applies for this visit */
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: code }))
  } catch {
    /* no CustomEvent — the setting page still works, it just won't live-update */
  }
}

/** Subscribe to changes from this tab and from others. Returns an unsubscribe. */
export function subscribeShopCountry(onChange: (code: string | null) => void): () => void {
  const here = (e: Event) => onChange((e as CustomEvent<string | null>).detail ?? null)
  const elsewhere = (e: StorageEvent) => {
    if (e.key === SHOP_COUNTRY_KEY) onChange(e.newValue)
  }
  window.addEventListener(CHANGE_EVENT, here)
  window.addEventListener('storage', elsewhere)
  return () => {
    window.removeEventListener(CHANGE_EVENT, here)
    window.removeEventListener('storage', elsewhere)
  }
}
