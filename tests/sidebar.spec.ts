import { test, expect } from '@playwright/test'

// Tate Modern area — zoom 17 disables clustering so london-south-001 and its
// neighbours are individually visible in the DOM.
const LONDON_HASH = '#51.5076,-0.0994,17'

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to London area at zoom 17 where individual markers are visible
    await page.goto(`./${LONDON_HASH}`)
    // Wait for bench data to load
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bench-count')
        const m  = el?.textContent?.match(/(\d+)/)
        return m !== null && parseInt(m[1]) > 0
      },
      { timeout: 15_000 }
    )
    // Wait for individual bench markers to appear in the DOM
    await page.waitForFunction(
      () => document.querySelectorAll('.bench-marker').length > 0,
      { timeout: 15_000 }
    )
  })

  test('sidebar is hidden on load', async ({ page }) => {
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/)
  })

  test('clicking a marker opens the sidebar', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    // Sidebar animates in (380ms)
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })
    await expect(page.locator('#sidebar-content .bench-detail-name')).toBeVisible()
  })

  test('sidebar shows correct bench data for london-south-001', async ({ page }) => {
    // london-south-001 is at the viewport centre — individually visible at zoom 17
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
    // Sidebar animates out (280ms), then hidden class is re-applied
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/, { timeout: 2_000 })
  })
})
