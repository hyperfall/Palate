import sharp from 'sharp'

/**
 * Generates a placeholder hero image.
 *
 * §11 Q4 (original photography vs. licensed vs. AI-generated) is unresolved, and
 * §4 is blunt that "food photography is the product". These are neither — they
 * are obviously-synthetic colour fields whose only job is to let us evaluate
 * layout before real photography exists. Every asset the seed creates is
 * credited as a placeholder so it can be found and replaced.
 */
export async function placeholderImage({
  width = 1600,
  height = 1000,
  from,
  to,
  seed,
}: {
  width?: number
  height?: number
  from: string
  to: string
  seed: string
}): Promise<Buffer> {
  // Deterministic angle per recipe so re-seeding doesn't reshuffle the catalog.
  const angle = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 90

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" gradientTransform="rotate(${angle})">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${angle}"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" filter="url(#grain)" opacity="0.11"/>
  </svg>`

  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()
}
