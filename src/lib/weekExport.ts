/**
 * Shared browser-side helpers for the week exports (PNG canvas + vector PDF):
 * resolving the live theme's colours and fonts, and preloading dish thumbnails.
 * Keeping these in one place means both renderers track the design system
 * instead of hardcoding constants.
 */

export type ThemeColors = {
  ink: string; milk: string; pan: string; flame: string; slate: string; rule: string; card: string; wash: string
}
export type ThemeFonts = { display: string; mono: string; body: string }

/** Resolve `--color-*` tokens to concrete rgb by reading them off a probe —
 *  getPropertyValue would return the literal `light-dark(...)` expression. */
export function resolveColors(): ThemeColors {
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const read = (token: string) => {
    probe.style.color = `var(--color-${token})`
    return getComputedStyle(probe).color || 'rgb(0,0,0)'
  }
  const colors: ThemeColors = {
    ink: read('ink'), milk: read('milk'), pan: read('pan'), flame: read('flame'),
    slate: read('slate'), rule: read('rule'), card: read('card'), wash: read('wash'),
  }
  probe.remove()
  return colors
}

export function resolveFonts(): ThemeFonts {
  const root = getComputedStyle(document.documentElement)
  return {
    display: root.getPropertyValue('--font-display').trim() || 'Georgia, serif',
    mono: root.getPropertyValue('--font-mono').trim() || 'monospace',
    body: root.getPropertyValue('--font-body').trim() || 'system-ui, sans-serif',
  }
}

/** Parse an rgb[a](...) string to a numeric tuple (for APIs that take channels). */
export function rgb(color: string): [number, number, number] {
  const m = color.match(/(\d+(?:\.\d+)?)/g)
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0]
}

export async function loadImages(urls: string[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>()
  await Promise.all(
    [...new Set(urls.filter(Boolean))].map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            map.set(url, img)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = url
        }),
    ),
  )
  return map
}

/** Every dish thumbnail URL in a week, in order. */
export const weekImageUrls = (days: { meals: { dishes: { image: string | null }[] }[] }[]): string[] =>
  days.flatMap((d) => d.meals.flatMap((m) => m.dishes.map((dish) => dish.image ?? ''))).filter(Boolean)
