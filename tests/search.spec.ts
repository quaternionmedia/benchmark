import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

const geojson = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL   = geojson.features.length
const ALL_LABEL = `${TOTAL} bench${TOTAL !== 1 ? 'es' : ''}`

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for bench count to settle on TOTAL
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

  test('search input is visible', async ({ page }) => {
    await expect(page.locator('#search-input')).toBeVisible()
  })

  test('searching by bench name narrows count', async ({ page }) => {
    await page.locator('#search-input').fill("Molin")
    // 200ms debounce — wait for it
    await page.waitForTimeout(300)
    await expect(page.locator('#bench-count')).toContainText('1 bench', { timeout: 3_000 })
  })

  test('clearing search restores full count', async ({ page }) => {
    await page.locator('#search-input').fill("Molin")
    await page.waitForTimeout(300)
    await expect(page.locator('#bench-count')).toContainText('1 bench', { timeout: 3_000 })

    await page.locator('#search-input').fill('')
    await page.waitForTimeout(300)
    await expect(page.locator('#bench-count')).toContainText(ALL_LABEL, { timeout: 5_000 })
  })

  test('searching by partial notes text narrows count', async ({ page }) => {
    // "fountain" appears in stockholm-demo-001 notes
    await page.locator('#search-input').fill('fountain')
    await page.waitForTimeout(300)
    await expect(page.locator('#bench-count')).toContainText('1 bench', { timeout: 3_000 })
  })

  test('search with no matches shows 0 benches', async ({ page }) => {
    await page.locator('#search-input').fill('xyzzy_no_match_xyzzy')
    await page.waitForTimeout(300)
    await expect(page.locator('#bench-count')).toContainText('0 bench', { timeout: 3_000 })
  })
})
