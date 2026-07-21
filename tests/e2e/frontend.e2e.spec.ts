import { expect, test } from '@playwright/test'

/**
 * These assert the success criteria from design spec §10 rather than incidental
 * markup — if one of these fails, the product promise is broken, not just a
 * class name.
 */

test.describe('Recipe-first (spec §1, §10)', () => {
  test('a cook can decide and start without scrolling past a story', async ({ page }) => {
    await page.goto('/recipes/mapo-tofu')

    // Everything needed to choose and begin must be in the first viewport.
    const viewport = page.viewportSize()!
    const mustBeAboveFold = [
      page.getByRole('heading', { level: 1, name: 'Mapo Tofu' }),
      page.getByRole('link', { name: /start cooking/i }),
      page.getByRole('meter', { name: /Heat/ }),
    ]

    for (const locator of mustBeAboveFold) {
      const box = await locator.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeLessThan(viewport.height)
    }
  })

  test('the story sits below the method, never above it', async ({ page }) => {
    await page.goto('/recipes/mapo-tofu')

    const method = (await page.getByRole('heading', { name: 'Method' }).boundingBox())!
    const notes = (await page.getByRole('heading', { name: 'Notes' }).boundingBox())!
    expect(notes.y).toBeGreaterThan(method.y)
  })

  test('ingredients and steps both render', async ({ page }) => {
    await page.goto('/recipes/mapo-tofu')
    await expect(page.getByText(/silken tofu/)).toBeVisible()
    await expect(page.getByText(/Slide the tofu into salted simmering water/)).toBeVisible()
  })

  test('the servings control rescales quantities honestly', async ({ page }) => {
    await page.goto('/recipes/mapo-tofu') // base: 3 servings, 400 g tofu

    await page.getByRole('button', { name: 'More servings' }).click()
    await page.getByRole('button', { name: 'More servings' }).click()
    await page.getByRole('button', { name: 'More servings' }).click() // 6 servings

    await expect(page.getByText('6 servings')).toBeVisible()
    await expect(page.getByText(/800 g/)).toBeVisible() // 400 g doubled
    // Unquantified ingredients stay as written — scaling them would be a lie.
    await expect(page.getByText(/spring onions/)).toBeVisible()
  })
})

test.describe('Structured data (spec §8)', () => {
  test('every recipe page carries valid Recipe JSON-LD', async ({ page }) => {
    await page.goto('/recipes/mapo-tofu')

    const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
    const ld = JSON.parse(raw!)

    expect(ld['@type']).toBe('Recipe')
    expect(ld.name).toBe('Mapo Tofu')
    expect(ld.recipeIngredient.length).toBeGreaterThan(0)
    expect(ld.recipeInstructions.length).toBeGreaterThan(0)
    expect(ld.author.name).toBeTruthy()
    expect(ld.totalTime).toMatch(/^PT/)

    // We have no ratings, so we must not claim any — a fabricated
    // aggregateRating is the structured-data spam §8 rules out.
    expect(ld.aggregateRating).toBeUndefined()
  })
})

test.describe('Faceted catalog (spec §7)', () => {
  test('filter state lives in the URL and survives a reload', async ({ page }) => {
    await page.goto('/recipes')
    const countLabel = page.getByText(/^\d+ recipes?$/)
    const total = await countLabel.textContent()

    await page.getByRole('button', { name: 'Vegan', exact: true }).click()
    await expect(page).toHaveURL(/diet=vegan/)

    await expect(countLabel).not.toHaveText(total!)
    const filtered = await countLabel.textContent()

    await page.reload()
    await expect(countLabel).toHaveText(filtered!)
  })

  test('a taste band can ask for "at least hot" — a floor, not just a ceiling', async ({
    page,
  }) => {
    await page.goto('/recipes?spiciness=4-5')
    await expect(page.getByRole('heading', { name: 'Mapo Tofu' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Oyakodon' })).toHaveCount(0)
  })

  test('legacy ceiling URLs keep working', async ({ page }) => {
    await page.goto('/recipes?spiciness=0')
    // Nothing with any heat may survive a "no heat" ceiling.
    await expect(page.getByRole('heading', { name: 'Mapo Tofu' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Oyakodon' })).toBeVisible()
  })

  test('the pager reaches recipes beyond the first page', async ({ page }) => {
    await page.goto('/recipes')
    const firstPageTitles = await page.locator('article h3').allTextContents()

    const pagination = page.getByRole('navigation', { name: 'Pagination' })
    await expect(pagination).toBeVisible()
    await pagination.getByRole('link', { name: '2', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)

    const secondPageTitles = await page.locator('article h3').allTextContents()
    expect(secondPageTitles.length).toBeGreaterThan(0)
    for (const title of secondPageTitles) {
      expect(firstPageTitles).not.toContain(title)
    }
  })

  test('an over-filtered catalog explains how to recover', async ({ page }) => {
    await page.goto('/recipes?spiciness=0&diet=vegan&time=15&difficulty=hard')
    await expect(page.getByText(/Nothing matches all of that/)).toBeVisible()
    await expect(page.getByRole('link', { name: /clear filters/i })).toBeVisible()
  })
})

test.describe('Home gauge semantics', () => {
  test('tapping the top of a flavour axis actually narrows to that flavour', async ({ page }) => {
    await page.goto('/')
    // The old ceiling model sent "Fiery" clicks to an unfiltered catalog.
    await page.getByRole('link', { name: /at least fiery/i }).click()
    await expect(page).toHaveURL(/spiciness=5-5/)
    await expect(page.getByRole('heading', { name: 'Som Tam' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Oyakodon' })).toHaveCount(0)
  })
})

test.describe('Partner disclosure (spec §1, §8)', () => {
  test('a brand card is labelled and does not pass PageRank', async ({ page }) => {
    await page.goto('/recipes/mapo-tofu')

    const slot = page.getByRole('complementary', { name: 'Partner' })
    await expect(slot).toBeVisible()

    const cta = slot.getByRole('link').first()
    await expect(cta).toHaveAttribute('rel', /sponsored/)
    await expect(cta).toHaveAttribute('rel', /nofollow/)
  })
})
