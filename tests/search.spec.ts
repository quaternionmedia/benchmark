import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

const geojson = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL = geojson.features.length

// Zoom 17 disables clustering so individual markers are in the DOM.
const STOCKHOLM_HASH = '#59.332,18.0717,17'

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`./${STOCKHOLM_HASH}`)
    // Wait for data to load and markers to appear
    await page.waitForFunction(
      () => document.querySelectorAll('.bench-marker').length > 0,
      { timeout: 15_000 }
    )
    // Wait for the count animation to finish (it writes on every frame; once it
    // stabilises at TOTAL the animation is effectively done and the cancel-on-
    // interact fix ensures subsequent writes are safe).
    await expect(page.locator('#bench-count')).toContainText(`${TOTAL}`, { timeout: 5_000 })
  })

  test('search by name filters markers and updates count', async ({ page }) => {
    // "Molin" matches only bench 001 — Molin's Fountain Bench
    await page.locator('#search-input').fill('Molin')
    await page.locator('#search-input').dispatchEvent('input')
    await expect(page.locator('#bench-count')).toContainText('1 bench', { timeout: 1_500 })
    await expect(page.locator('.bench-marker')).toHaveCount(1)
  })

  test('search by notes filters markers and updates count', async ({ page }) => {
    // "granite" appears in bench 003 notes — Karl XII:s Torg Corner
    await page.locator('#search-input').fill('granite')
    await page.locator('#search-input').dispatchEvent('input')
    await expect(page.locator('#bench-count')).toContainText('1 bench', { timeout: 1_500 })
    await expect(page.locator('.bench-marker')).toHaveCount(1)
  })

  test('no-match search shows zero benches', async ({ page }) => {
    await page.locator('#search-input').fill('xyznotfound')
    await page.locator('#search-input').dispatchEvent('input')
    await expect(page.locator('#bench-count')).toContainText('0 benches', { timeout: 1_500 })
    await expect(page.locator('.bench-marker')).toHaveCount(0)
  })

  test('clearing search restores full count', async ({ page }) => {
    // Filter down first
    await page.locator('#search-input').fill('Molin')
    await page.locator('#search-input').dispatchEvent('input')
    await expect(page.locator('#bench-count')).toContainText('1 bench', { timeout: 1_500 })

    // Clear — Escape key path in search.js fires immediately (no debounce)
    await page.locator('#search-input').press('Escape')
    await expect(page.locator('#bench-count')).toContainText(`${TOTAL}`, { timeout: 1_500 })
    await expect(page.locator('.bench-marker')).toHaveCount(TOTAL)
  })
})
