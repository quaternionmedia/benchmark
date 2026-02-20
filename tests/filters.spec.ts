import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

const geojson = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL         = geojson.features.length
const POOR_COUNT    = geojson.features.filter((f: any) => f.properties.condition === 'poor').length
const BACKREST_COUNT = geojson.features.filter((f: any) => f.properties.backrest === true).length

test.describe('Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for the bench-count animation to reach TOTAL, then hold for an extra
    // tick so any straggling RAF calls from animateBenchCount have fired.
    // Without the pause, the animation's last update() tick can fire ~16-33ms
    // after count first hits TOTAL and overwrite a filter-driven count change.
    await page.waitForFunction(
      (total: number) => {
        const el = document.getElementById('bench-count')
        const m  = el?.textContent?.match(/(\d+)/)
        return m !== null && parseInt(m[1]) === total
      },
      TOTAL,
      { timeout: 15_000 }
    )
    await page.waitForTimeout(150)  // flush any trailing animation ticks
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

    // applyMarkerFilter uses clearLayers/addLayers — bench-count is set synchronously.
    const label = `${POOR_COUNT} bench${POOR_COUNT !== 1 ? 'es' : ''}`
    await expect(page.locator('#bench-count')).toContainText(label, { timeout: 5_000 })
  })

  test('resetting condition to all restores full bench count', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('.chip[data-filter="condition"][data-value="poor"]').click()
    const poorLabel = `${POOR_COUNT} bench${POOR_COUNT !== 1 ? 'es' : ''}`
    await expect(page.locator('#bench-count')).toContainText(poorLabel, { timeout: 5_000 })

    await page.locator('.chip[data-filter="condition"][data-value="all"]').click()
    const allLabel = `${TOTAL} bench${TOTAL !== 1 ? 'es' : ''}`
    await expect(page.locator('#bench-count')).toContainText(allLabel, { timeout: 10_000 })
  })

  test('backrest filter updates bench count to backrest-only benches', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#filter-backrest').check()

    const label = `${BACKREST_COUNT} bench${BACKREST_COUNT !== 1 ? 'es' : ''}`
    await expect(page.locator('#bench-count')).toContainText(label, { timeout: 5_000 })
  })
})
