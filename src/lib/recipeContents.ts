/**
 * The contents of a recipe page.
 *
 * The story's contents block (see storyOutline) is derived from prose and only
 * appears when a story is long enough to need one — which, given storyMarkdown
 * caps at 5,000 characters, is rare. This is the other kind of contents: not
 * derived from writing, but from what the recipe *has*. Every recipe carries
 * ingredients and a method, so every recipe gets a contents list.
 *
 * That distinction matters on a phone, where the page is one column and the
 * ingredient list stands between the reader and the cooking. On a wide screen
 * the ingredients are already pinned beside the method, so the list is doing
 * less work — which is why it rides in the same sticky rail rather than
 * claiming a band of its own.
 *
 * Sections are listed only when they exist. A contents entry that scrolls to
 * nothing is worse than no entry.
 */

export type RecipeSection = { id: string; label: string }

export type RecipeSectionInput = {
  hasVideo: boolean
  hasStory: boolean
  hasRelated: boolean
}

export function recipeSections({
  hasVideo,
  hasStory,
  hasRelated,
}: RecipeSectionInput): RecipeSection[] {
  const sections: RecipeSection[] = [
    { id: 'ingredients', label: 'Ingredients' },
    { id: 'method', label: 'Method' },
  ]
  if (hasVideo) sections.push({ id: 'watch', label: 'Watch' })
  if (hasStory) sections.push({ id: 'notes', label: 'Notes' })
  if (hasRelated) sections.push({ id: 'more', label: 'More like this' })
  return sections
}

/**
 * Which section is the reader in, given each section's distance from the top
 * of the viewport?
 *
 * The last section whose top has crossed the reading line. Two rules it beats:
 * "the topmost section still visible" leaves a long section unmarked as soon
 * as the next one peeks in from below, and "the section covering the most
 * screen" flickers between a short section and the tall one behind it.
 *
 * Separated from the component because it is the only part with a right
 * answer, and the browser it runs in cannot be scrolled under test.
 */
export function activeSection(
  tops: Array<{ id: string; top: number }>,
  readingLine: number,
): string {
  let current = ''
  for (const { id, top } of tops) {
    if (top <= readingLine) current = id
  }
  return current
}
