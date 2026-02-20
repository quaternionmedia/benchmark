import { test, expect } from '@playwright/test'

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for marker animation to complete
    await page.waitForTimeout(900)
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

  test('sidebar shows correct bench data for central-park-001', async ({ page }) => {
    await page.locator('[data-id="central-park-001"]').dispatchEvent('click')
    await expect(page.locator('#sidebar-content')).toContainText('Bethesda Terrace West Bench', { timeout: 2_000 })
    await expect(page.locator('#sidebar-content')).toContainText('Central Park')
    await expect(page.locator('#sidebar-content')).toContainText('good')
    await expect(page.locator('#sidebar-content')).toContainText('wood')
    await expect(page.locator('#sidebar-content')).toContainText('3')
  })

  test('closing sidebar hides it', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })

    await page.locator('#sidebar-close').click()
    // Sidebar animates out (280ms), then hidden class is added
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/, { timeout: 2_000 })
  })
})
