import { describe, expect, it } from 'vitest'

import { isUpscaled, laplacianVariance, SOFT_BELOW } from '@/lib/imageSharpness'

/** A greyscale field built from a generator, so the tests state their content. */
const field = (w: number, h: number, f: (x: number, y: number) => number) => {
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x, y) & 255
  return { data, width: w, height: h }
}

describe('laplacianVariance', () => {
  it('scores a flat field at zero — nothing to be sharp about', () => {
    expect(laplacianVariance(field(32, 32, () => 128))).toBe(0)
  })

  it('scores fine detail far above a soft gradient', () => {
    // A gradient is the smoothest thing that is not flat; per-pixel noise is
    // the sharpest. Everything real falls between them.
    const gradient = laplacianVariance(field(64, 64, (x) => x * 4))
    const detail = laplacianVariance(field(64, 64, (x, y) => ((x + y) % 2) * 255))
    expect(detail).toBeGreaterThan(gradient * 100)
  })

  it('falls when the same image is blurred — the property the check relies on', () => {
    const checks = field(64, 64, (x, y) => (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 220 : 40)
    // A 2x box blur of the same pattern.
    const blurred = field(64, 64, (x, y) => {
      let sum = 0
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 4; dx++) {
          const v = (Math.floor((x + dx - 2) / 4) + Math.floor((y + dy - 2) / 4)) % 2 ? 220 : 40
          sum += v
        }
      return sum / 16
    })
    expect(laplacianVariance(blurred)).toBeLessThan(laplacianVariance(checks))
  })

  it('survives images too small to have an interior', () => {
    expect(laplacianVariance(field(2, 2, () => 100))).toBe(0)
    expect(laplacianVariance(field(0, 0, () => 0))).toBe(0)
  })
})

describe('isUpscaled', () => {
  it('accuses a large file that carries no detail', () => {
    // The measured population: enlarged imports scored 28-57 at 1600px.
    expect(isUpscaled(28, 1600)).toBe(true)
    expect(isUpscaled(57, 1600)).toBe(true)
  })

  it('leaves genuine photographs alone', () => {
    // The other measured population: real photographs scored 195-215.
    expect(isUpscaled(195, 1600)).toBe(false)
    expect(isUpscaled(216, 1200)).toBe(false)
  })

  it('never accuses a small image, which is allowed to be small', () => {
    // A sharp 600px photo is not an upscale; it is just a small photo, and
    // re-encoding it would only lose detail.
    expect(isUpscaled(10, 600)).toBe(false)
    expect(isUpscaled(10, 1199)).toBe(false)
  })

  it('keeps the threshold below the sharpest thing it accuses', () => {
    // Guards against someone raising SOFT_BELOW until it catches real photos.
    expect(SOFT_BELOW).toBeLessThan(195)
  })
})
