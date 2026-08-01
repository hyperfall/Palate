/**
 * Site-wide constants.
 *
 * §11 Q1 (product name + domain) is still open. "Palate" is a working wordmark,
 * not a decision — it lives here alone so renaming is a one-line change with no
 * hunt through components.
 */
export const SITE = {
  name: 'Palate',
  /**
   * The company behind the site. Palate is the product; Endarc Limited is who
   * you are actually contracting with and who answers a data request — which
   * is why it belongs in the terms, the privacy note and the footer rather
   * than only in a filing somewhere.
   */
  company: 'Endarc Limited',
  tagline: 'Cook first. Read later, if you feel like it.',
  description:
    'A recipe site built the other way round: the recipe is at the top, filtered by how it actually tastes.',
  /** Used for canonical URLs, sitemap, and OG tags. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString()
}
