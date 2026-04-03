import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load total bench count directly from the compiled GeoJSON so this test
// stays correct after any Overpass refresh without manual edits.
const geojson  = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL    = geojson.features.length
const TOTAL_RE = new RegExp(String(TOTAL))

test.describe('App load', () => {
  test('loads without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      // Exclude browser-generated network errors (e.g. tile server 503s) —
      // those are infrastructure noise, not app bugs.
      if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) {
        errors.push(msg.text())
      }
    })
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('.')
    // Wait for bench count to show the full total (data loaded + animation done)
    await expect(page.locator('#bench-count')).toContainText(TOTAL_RE, { timeout: 15_000 })

    expect(errors).toHaveLength(0)
  })

  test('bench count matches compiled data', async ({ page }) => {
    await page.goto('.')
    await expect(page.locator('#bench-count')).toContainText(TOTAL_RE, { timeout: 15_000 })
  })

  test('page title is correct', async ({ page }) => {
    await page.goto('.')
    await expect(page).toHaveTitle(/benchmark/)
  })
})
