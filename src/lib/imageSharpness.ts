/**
 * How much real detail is in an image?
 *
 * The variance of a 3x3 Laplacian — the standard blur metric. A photograph
 * that was enlarged before upload carries no more detail than its small
 * source, but its width says otherwise, so every guard that trusts the stored
 * width is fooled. This measures the pixels instead.
 *
 * Calibrated against this project's own media: genuine photographs score
 * 195-215 at native size, while the enlarged imports score 28-57.
 */

export type Grey = { data: Uint8Array | Buffer; width: number; height: number }

export function laplacianVariance({ data, width, height }: Grey): number {
  if (width < 3 || height < 3) return 0
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const v = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - width] - data[i + width]
      sum += v
      sumSq += v * v
      n++
    }
  }
  if (n === 0) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

/**
 * Below this, an image is soft enough that its stored width is overstating
 * what it can actually show. Set between the two populations measured in this
 * library (enlarged imports topped out at 57; real photographs started at 195)
 * and deliberately nearer the low one, so the check accuses nothing it cannot
 * prove.
 */
export const SOFT_BELOW = 90

export function isUpscaled(sharpness: number, width: number): boolean {
  // Small images are legitimately sharp per-pixel; the complaint is only ever
  // about a file claiming a size it cannot fill with detail.
  return width >= 1200 && sharpness < SOFT_BELOW
}
