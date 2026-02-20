import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// Derive expected counts directly from compiled data so tests stay correct
// after any Overpass refresh.
const geojson = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL   = geojson.features.length
const conditionCounts: Record<string, number> = {}
for (const f of geojson.features) {
  const c = f.properties.condition as string
  conditionCounts[c] = (conditionCounts[c] ?? 0) + 1
}

test.describe('Markers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for all markers to be inserted into the DOM (data load complete).
    // Use waitForFunction rather than a fixed timeout — with large datasets the
    // stagger animation takes several seconds before the first marker is visible.
    await page.waitForFunction(
      (count) => document.querySelectorAll('.bench-marker').length >= count,
      TOTAL,
      { timeout: 15_000 }
    )
  })

  test('all markers are present in the DOM', async ({ page }) => {
    const markers = page.locator('.bench-marker')
    await expect(markers).toHaveCount(TOTAL)
  })

  test('markers have correct condition classes', async ({ page }) => {
    for (const [cond, count] of Object.entries(conditionCounts)) {
      await expect(page.locator(`.bench-marker.cond-${cond}`)).toHaveCount(count)
    }
  })

  test('markers are visible after animation completes', async ({ page }) => {
    // Wait until at least the first marker has fully animated in.
    // With large datasets and center-stagger the outermost markers take several
    // seconds; poll until opacity > 0.9 rather than sleeping a fixed amount.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.bench-marker')
        return !!el && parseFloat(window.getComputedStyle(el).opacity) > 0.9
      },
      { timeout: 15_000 }
    )

    const opacity = await page.locator('.bench-marker').first().evaluate(
      el => parseFloat(window.getComputedStyle(el).opacity)
    )
    expect(opacity).toBeGreaterThan(0.9)
  })
})
