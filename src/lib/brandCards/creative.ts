/**
 * Which image a brand card shows.
 *
 * A campaign can carry several creatives. They rotate per visitor rather than
 * per request so a given reader sees a consistent card while they browse —
 * flipping the picture on every page load reads as a glitch, not as variety —
 * and so the rotation is reproducible for a given visitor key.
 *
 * Pure, like the card selection beside it: the caller hands in plain data, and
 * the Payload document shape stays out of the decision.
 */

export type Creative = {
  /** Whatever the caller uses to resolve an image. Opaque here. */
  image: unknown
  tagline?: string | null
  active?: boolean | null
}

export type ChosenCreative = {
  image: unknown
  /** The creative's own line, or null to fall back to the campaign tagline. */
  tagline: string | null
  /** Which slot of the rotation this was, for logging and tests. */
  index: number
}

/**
 * Same hash the card rotation uses. Repeated rather than shared because these
 * two rotations must be able to diverge without one silently reshuffling the
 * other — a visitor whose card order changes should not also have every
 * creative change underneath them.
 */
function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * The creatives that can actually reach a reader.
 *
 * Exported because the admin preview has to step through exactly this set. If
 * the preview and the runtime disagreed about which images are eligible, an
 * editor could approve a creative that never ships — or, worse, miss one that
 * does. One rule, two callers.
 *
 * Retired creatives are dropped, not counted — otherwise switching one off
 * would leave a hole in the rotation that shows nothing at all.
 */
export function liveCreatives(creatives: Creative[] | null | undefined): Creative[] {
  return (creatives ?? []).filter((c) => c.active !== false && Boolean(c.image))
}

/**
 * Pick one creative for this visitor, or null when the card carries none and
 * the caller should fall back to its single image.
 */
export function pickCreative(
  creatives: Creative[] | null | undefined,
  visitorKey: string,
  cardId: string | number,
): ChosenCreative | null {
  const live = liveCreatives(creatives)
  if (live.length === 0) return null

  // Salt with the card id so a visitor does not land on slot 0 of every
  // campaign at once — with several cards on a page that would show every
  // brand's first creative to the same person, every time.
  const index = hash(`${visitorKey}:${cardId}`) % live.length
  const chosen = live[index]
  return {
    image: chosen.image,
    tagline: chosen.tagline?.trim() ? chosen.tagline.trim() : null,
    index,
  }
}
