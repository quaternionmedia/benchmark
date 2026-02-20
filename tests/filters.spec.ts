import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

const geojson = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL         = geojson.features.length
const POOR_COUNT    = geojson.features.filter((f: any) => f.properties.condition === 'poor').length
const BACKREST_COUNT = geojson.features.filter((f: any) => f.properties.backrest === true).length

/** Wait for bench-count to show a specific numeric value. */
async function waitForBenchCount(page: any, count: number) {
  await page.waitForFunction(
    (expected: number) => {
      const el = document.getElementById('bench-count')
      const m  = el?.textContent?.match(/(\d+)/)
      return m !== null && parseInt(m[1]) === expected
    },
    count,
    { timeout: 10_000 }
  )
}

test.describe('Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for the bench-count animation to complete and settle on TOTAL.
    // animateBenchCount runs for ~1300ms on load; waiting for the exact total
    // ensures the animation won't overwrite filter-driven count changes.
    await page.waitForFunction(
      (total: number) => {
        const el = document.getElementById('bench-count')
        const m  = el?.textContent?.match(/(\d+)/)
        return m !== null && parseInt(m[1]) === total
      },
      TOTAL,
      { timeout: 15_000 }
    )
  })

  test('filter panel is hidden on load', async ({ page }) => {
    await expect(page.locator('#filter-panel')).toHaveClass(/hidden/)
  })

  test('clicking filter button shows the filter panel', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#filter-panel')).toBeVisible()
  })

  test('clicking filter button again hides the filter panel', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).toHaveClass(/hidden/, { timeout: 1_000 })
  })

  test('filtering by condition=poor updates bench count', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('.chip[data-filter="condition"][data-value="poor"]').click()

    // applyMarkerFilter is synchronous (clearLayers + addLayers) so the count
    // updates immediately — no animation delay to wait for.
    await waitForBenchCount(page, POOR_COUNT)
    const label = `${POOR_COUNT} bench${POOR_COUNT !== 1 ? 'es' : ''}`
    await expect(page.locator('#bench-count')).toContainText(label)
  })

  test('resetting condition to all restores full bench count', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('.chip[data-filter="condition"][data-value="poor"]').click()
    await waitForBenchCount(page, POOR_COUNT)

    await page.locator('.chip[data-filter="condition"][data-value="all"]').click()
    await waitForBenchCount(page, TOTAL)
    const label = `${TOTAL} bench${TOTAL !== 1 ? 'es' : ''}`
    await expect(page.locator('#bench-count')).toContainText(label)
  })

  test('backrest filter updates bench count to backrest-only benches', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#filter-backrest').check()

    await waitForBenchCount(page, BACKREST_COUNT)
    const label = `${BACKREST_COUNT} bench${BACKREST_COUNT !== 1 ? 'es' : ''}`
    await expect(page.locator('#bench-count')).toContainText(label)
  })
})
