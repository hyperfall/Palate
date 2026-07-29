import type { MetadataRoute } from 'next'

/**
 * Web app manifest — what makes Palate installable to a phone's home screen.
 *
 * This is a cooking site: the pantry, the plan, shopping mode and cook mode all
 * assume someone standing in a kitchen with the page open. A home-screen icon
 * that launches without browser chrome is the difference between a site
 * somebody visited once and a tool they reach for while the pan heats.
 *
 * `display: standalone` drops the URL bar, which also stops a wet thumb landing
 * on it mid-recipe. Portrait is not locked — plenty of people prop a phone
 * sideways against a bag of flour.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Palate — cook first',
    short_name: 'Palate',
    description:
      'Recipes filtered by how a dish actually tastes. Cook from what you have, plan the week, shop once.',
    start_url: '/',
    // Opens on the board rather than a marketing page: someone launching from
    // the home screen is here to cook, not to be introduced to the product.
    id: '/',
    display: 'standalone',
    // Matches the header's pan colour so the status bar blends into the site
    // instead of leaving a pale strip above it.
    theme_color: '#14100c',
    background_color: '#f1f2ec',
    orientation: 'any',
    categories: ['food', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate maskable entry: Android crops to whatever shape the launcher
      // uses, and an icon that isn't declared maskable gets letterboxed into a
      // white square instead.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      // Long-press the home-screen icon: the three things someone opens the
      // app to do, without loading the homepage first.
      { name: 'Tonight', short_name: 'Tonight', url: '/tonight' },
      { name: 'Cook from what you have', short_name: 'Cook from', url: '/cook-from' },
      { name: 'This week', short_name: 'Plan', url: '/plan' },
    ],
  }
}
