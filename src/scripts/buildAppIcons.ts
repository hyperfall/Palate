import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

/**
 * Generate the home-screen icons from the site mark.
 *
 * Committed as a script rather than checked-in binaries with no provenance: if
 * the mark or the palette changes, `npm run icons` regenerates every size from
 * one source instead of leaving stale PNGs nobody can reproduce.
 *
 * The mark is the four taste axes — heat, sweetness, richness, effort — which
 * is the one thing the whole site is organised around.
 */

const BARS = [
  { y: 7, w: 22, fill: '#C2412A' }, // heat
  { y: 13, w: 14, fill: '#B07F22' }, // sweetness
  { y: 19, w: 18, fill: '#5D6B38' }, // richness
  { y: 25, w: 9, fill: '#465061' }, // effort
]

/**
 * `inset` shrinks the mark inside the canvas for maskable icons: Android crops
 * to a circle on many launchers, and anything outside the middle 80% can be
 * cut off. A full-bleed mark would lose the shortest bar.
 */
function markSvg({ size, inset = 0, bg = '#FBFBF9' }: { size: number; inset?: number; bg?: string }): string {
  const scale = (32 - inset * 2) / 32

  // The favicon's bars sit low in their box — 7 units of headroom against 3.5
  // below. Invisible at 32px; obvious at 512, and worse under the circular crop
  // a launcher applies, which centres on the canvas and not on the artwork. So
  // centre the block of bars rather than inheriting the source's offset.
  const top = BARS[0].y
  const bottom = BARS[BARS.length - 1].y + 3.5
  const shift = (32 - (bottom - top)) / 2 - top

  const rects = BARS.map(
    (b) =>
      `<rect x="${(5 * scale + inset).toFixed(2)}" y="${((b.y + shift) * scale + inset).toFixed(2)}" ` +
      `width="${(b.w * scale).toFixed(2)}" height="${(3.5 * scale).toFixed(2)}" fill="${b.fill}"/>`,
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
    <rect width="32" height="32" fill="${bg}"/>${rects}</svg>`
}

const OUT = path.join(process.cwd(), 'public')
await mkdir(OUT, { recursive: true })

const targets = [
  // The browser-tab favicon. Explicitly generated because the app-router file
  // convention stopped emitting <link rel="icon"> once layout metadata declared
  // an apple icon — setting metadata.icons REPLACES the convention's links,
  // which silently cost the site its favicon.
  { file: 'icon-32.png', size: 32, inset: 0 },
  { file: 'icon-192.png', size: 192, inset: 0 },
  { file: 'icon-512.png', size: 512, inset: 0 },
  // Maskable: the mark pulled well inside the safe zone so a circular crop
  // can't clip it.
  { file: 'icon-maskable-512.png', size: 512, inset: 4 },
  // Apple ignores maskable and never adds a background, so this one ships its
  // own opaque paper ground rather than showing black behind the bars.
  { file: 'apple-icon-180.png', size: 180, inset: 2 },
]

for (const t of targets) {
  const png = await sharp(Buffer.from(markSvg({ size: t.size, inset: t.inset })))
    .resize(t.size, t.size)
    .png()
    .toBuffer()
  await writeFile(path.join(OUT, t.file), png)
  console.log(`${t.file}  ${t.size}×${t.size}${t.inset ? `  (inset ${t.inset})` : ''}`)
}

// Vector favicon alongside the raster ones — sharp at any tab density.
await writeFile(path.join(OUT, 'icon.svg'), markSvg({ size: 32 }))
console.log('icon.svg  vector')

console.log(`\n${targets.length + 1} icons written to public/`)
process.exit(0)
