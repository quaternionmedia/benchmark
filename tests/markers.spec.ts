import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// Derive expected counts directly from compiled data so tests stay correct
// after any data refresh.
const geojson = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL   = geojson.features.length

// Tate Modern area — zoom 17 disables clustering (disableClusteringAtZoom: 17)
// so individual bench markers appear in the DOM rather than cluster badges.
const LONDON_HASH = '#51.5076,-0.0994,17'

test.describe('Markers', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to London area at zoom 17 where clustering is disabled
    await page.goto(`./${LONDON_HASH}`)
    // Wait for bench data to load (bench-count animates to a number > 0)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bench-count')
        const m = el?.textContent?.match(/(\d+)/)
        return m !== null && parseInt(m[1]) > 0
      },
      { timeout: 15_000 }
    )
    // Wait for at least one individual marker to be visible in the DOM
    await page.waitForFunction(
      () => document.querySelectorAll('.bench-marker').length > 0,
      { timeout: 15_000 }
    )
  })

  test('bench count reflects all benches on load', async ({ page }) => {
    // No filter is active — bench-count should eventually settle on TOTAL
    await expect(page.locator('#bench-count')).toContainText(`${TOTAL}`, { timeout: 5_000 })
  })

  test('markers have condition classes', async ({ page }) => {
    // At zoom 17, individual markers are visible; each must carry a cond-* class
    const first = page.locator('.bench-marker').first()
    await expect(first).toHaveClass(/cond-/)
  })

  test('markers are visible at full opacity', async ({ page }) => {
    // Markers rendered individually (no cluster) should have opacity 1
    const opacity = await page.locator('.bench-marker').first().evaluate(
      el => parseFloat(window.getComputedStyle(el).opacity)
    )
    expect(opacity).toBeGreaterThan(0.9)
  })
})
