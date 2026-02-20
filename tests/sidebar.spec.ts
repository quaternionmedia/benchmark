import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

const geojson = JSON.parse(readFileSync(join(process.cwd(), 'public/data/benches.geojson'), 'utf8'))
const TOTAL   = geojson.features.length

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for all markers to be in the DOM before interacting
    await page.waitForFunction(
      (count) => document.querySelectorAll('.bench-marker').length >= count,
      TOTAL,
      { timeout: 15_000 }
    )
  })

  test('sidebar is hidden on load', async ({ page }) => {
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/)
  })

  test('clicking a marker opens the sidebar', async ({ page }) => {
    // Use dispatchEvent to bypass Leaflet marker overlap pointer interception
    await page.locator('.bench-marker').first().dispatchEvent('click')
    // Sidebar animates in (380ms)
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })
    await expect(page.locator('#sidebar-content .bench-detail-name')).toBeVisible()
  })

  test('sidebar shows correct bench data for london-south-001', async ({ page }) => {
    // london-south-001 is a stable curated seed bench unaffected by Overpass imports
    await page.locator('[data-id="london-south-001"]').dispatchEvent('click')
    await expect(page.locator('#sidebar-content')).toContainText('Tate Modern Riverside Bench', { timeout: 2_000 })
    await expect(page.locator('#sidebar-content')).toContainText('London South')
    await expect(page.locator('#sidebar-content')).toContainText('good')
    await expect(page.locator('#sidebar-content')).toContainText('stone')
    await expect(page.locator('#sidebar-content')).toContainText('4')
  })

  test('closing sidebar hides it', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })

    await page.locator('#sidebar-close').click()
    // Sidebar animates out (280ms), then hidden class is added
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/, { timeout: 2_000 })
  })
})
