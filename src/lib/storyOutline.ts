/**
 * Reading estimates and section outlines for recipe stories.
 *
 * Pure and tested, because both story paths (plain rich-text and markdown) must
 * agree — a story that says "2 min read" in one renderer and "3 min" in the
 * other is worse than neither saying anything.
 */

/** Words per minute for adult silent reading of easy prose — the conservative
 *  end of the usual 200–260 range, so an estimate is more often generous than
 *  short. */
const WPM = 200

export function countStoryWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * "Under a minute" rather than "0 min read": a rounded zero reads as an error,
 * and most recipe notes are genuinely shorter than a minute.
 */
export function readingTime(text: string): string {
  const words = countStoryWords(text)
  if (words === 0) return ''
  const minutes = words / WPM
  if (minutes < 1) return 'Under a minute'
  return `${Math.round(minutes)} min read`
}

export type StoryHeading = { depth: 2 | 3; text: string; id: string }

/**
 * A URL-safe id for a heading, matched between the outline and the rendered
 * heading so a contents link actually lands.
 *
 * Deliberately a PURE function of the text, with no dedup counter. The first
 * version threaded a running tally so repeated titles could get -2, -3 suffixes
 * — but the renderer has to derive ids during render, React calls those
 * component functions more than once, and the counter advanced each time. The
 * result: contents links pointing at #the-adobo while the heading had become
 * id="the-adobo-2". Every link missed.
 *
 * The cost of purity is that two headings with identical text share an anchor
 * and a jump lands on the first. That is a far smaller failure than links that
 * never land, and it cannot drift as rendering changes.
 */
export function headingId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'section'
  )
}

/** The h2/h3 headings of a markdown story, in document order. */
export function outlineOf(markdown: string): StoryHeading[] {
  const out: StoryHeading[] = []
  // Fenced code can contain lines starting with #; they are not headings.
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const text = m[2].replace(/[*_`]/g, '').trim()
    if (!text) continue
    out.push({ depth: m[1].length === 2 ? 2 : 3, text, id: headingId(text) })
  }
  return out
}

/**
 * Does this story earn a table of contents?
 *
 * Guidance puts a ToC at roughly 3,000 words for articles, but a recipe note is
 * a different animal — and the storyMarkdown field is capped at 5,000
 * characters, which is about 850 words. A threshold of 800 would therefore fire
 * only for stories within a whisker of the maximum possible length, i.e. almost
 * never. 500 words is the real line: past two minutes of reading, with three or
 * more sections, scrolling costs enough that a contents block earns its space.
 *
 * Below it, no contents block — a list of links taller than the prose it
 * indexes is furniture, not navigation.
 */
export const CONTENTS_MIN_WORDS = 500

export function deservesContents(markdown: string, headings: StoryHeading[]): boolean {
  return countStoryWords(markdown) >= CONTENTS_MIN_WORDS && headings.length >= 3
}
