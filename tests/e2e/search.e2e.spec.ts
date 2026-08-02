import { expect, test } from '@playwright/test'

/**
 * Search behaviour, end to end.
 *
 * These cover the promises a search box makes rather than its markup: that a
 * misspelling still finds the dish, that two words about one dish work even
 * when they live in different fields, that the site never quietly answers a
 * different question than the one typed, and — most importantly — that
 * forgiveness never widens a search past the filters someone has already set.
 */

test.describe('Catalog search — accuracy', () => {
  test('two words about one dish match across different fields', async ({ page }) => {
    // "tofu" is in the title, "chinese" is the cuisine. Matching each word only
    // within a single field found nothing at all for this.
    await page.goto('/recipes?q=tofu+chinese')
    await expect(page.getByRole('link', { name: /Mapo Tofu/i }).first()).toBeVisible()
  })

  test('an exact search is untouched by the forgiving path', async ({ page }) => {
    await page.goto('/recipes?q=shakshuka')
    await expect(page.getByRole('link', { name: /Shakshuka/i }).first()).toBeVisible()
    // No correction notice: this matched exactly, so nothing was guessed.
    await expect(page.getByText(/Nothing matched/i)).toHaveCount(0)
  })
})

test.describe('Catalog search — forgiving a misspelling', () => {
  test('the other correct spelling still finds the dish', async ({ page }) => {
    await page.goto('/recipes?q=shakshouka')
    await expect(page.getByRole('link', { name: /Shakshuka/i }).first()).toBeVisible()
  })

  test('a typo in one word of a two-word query still lands', async ({ page }) => {
    await page.goto('/recipes?q=butter+chiken')
    await expect(page.getByRole('link', { name: /Butter Chicken/i }).first()).toBeVisible()
  })

  test('it says the spelling was forgiven rather than guessing silently', async ({ page }) => {
    // A search that answers a different question without saying so is how it
    // loses trust. The typed term must still be shown, in case the guess is wrong.
    await page.goto('/recipes?q=shakshouka')
    await expect(page.getByText(/Nothing matched/i)).toBeVisible()
    await expect(page.getByText(/shakshouka/)).toBeVisible()
  })

  test('a query that is simply not there gets an honest empty state', async ({ page }) => {
    await page.goto('/recipes?q=xyzzyqqq')
    await expect(page.getByText(/Nothing matched/i)).toHaveCount(0)
    await expect(page.locator('a[href^="/recipes/"]')).toHaveCount(0)
  })

  test('forgiveness never widens past the filters already set', async ({ page }) => {
    // The single most important property here. Someone narrowed to Thai who
    // then mistypes the dish must not be handed an Indian recipe — the fallback
    // replaces the search term, it does not drop the rest of the filter state.
    await page.goto('/recipes?q=chiken&cuisine=indian')
    await expect(page.getByRole('link', { name: /Butter Chicken/i }).first()).toBeVisible()

    await page.goto('/recipes?q=chiken&cuisine=thai')
    await expect(page.locator('a[href^="/recipes/"]')).toHaveCount(0)
  })
})

test.describe('Nav search suggestions', () => {
  test('a misspelling still suggests the recipe', async ({ page }) => {
    const body = await page.request.get('/search-suggest?q=shakshouka').then((r) => r.json())
    expect(body.results.map((r: { title: string }) => r.title).join(' ')).toMatch(/Shakshuka/i)
  })

  test('an exact match still outranks a near-miss', async ({ page }) => {
    // The fuzzy tier fills an empty list; it must never push an exact match down.
    const body = await page.request.get('/search-suggest?q=mapo').then((r) => r.json())
    expect(body.results[0].title).toMatch(/Mapo/i)
  })

  test('nonsense suggests nothing at all', async ({ page }) => {
    const body = await page.request.get('/search-suggest?q=xyzzyqqq').then((r) => r.json())
    expect(body.results).toHaveLength(0)
  })
})

test.describe('Filter panel', () => {
  test('every facet is on the page, not hidden behind an inner scrollbar', async ({ page }) => {
    // The column used to be clamped to the viewport with its own scrollbar, so
    // which kitchens the catalogue offers was a thing you had to discover.
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/recipes')

    for (const facet of ['Meal', 'Cuisine', 'Taste', 'Rating', 'Time', 'Difficulty', 'Diet']) {
      await expect(page.getByText(facet, { exact: true }).first()).toBeAttached()
    }

    // No descendant of the filter column may be its own scroll container.
    const innerScrollers = await page.locator('aside').evaluate((aside) =>
      [...aside.querySelectorAll('*')].filter((el) => {
        const cs = getComputedStyle(el as HTMLElement)
        return (
          (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
          (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 4
        )
      }).length,
    )
    expect(innerScrollers).toBe(0)
  })
})
