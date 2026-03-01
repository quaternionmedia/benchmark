import { test, expect } from '@playwright/test'

test.describe('GPS controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for bench count to show any number (data loaded)
    await page.waitForFunction(
      () => document.getElementById('bench-count')?.textContent?.match(/\d+/),
      { timeout: 15_000 }
    )
  })

  test('locate me button is present and accessible', async ({ page }) => {
    const btn = page.locator('#gps-locate')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-label', 'Jump to current location')
    await expect(btn).toHaveAttribute('title', 'Jump to your current location')
  })

  test('nearest bench button is present and accessible', async ({ page }) => {
    const btn = page.locator('#gps-nearest')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-label', 'Find nearest bench')
    await expect(btn).toHaveAttribute('title', 'Find the nearest bench')
  })

  test('import area button is present', async ({ page }) => {
    await expect(page.locator('#import-toggle')).toBeVisible()
  })

  test('locate me button gains active class while locating', async ({ page }) => {
    // Override geolocation to prevent a real OS prompt; button should still
    // add the active class before the (denied) response arrives.
    await page.context().grantPermissions([])   // deny location
    const btn = page.locator('#gps-locate')
    await btn.click()
    // The active class is added synchronously before the async location event
    await expect(btn).toHaveClass(/active/, { timeout: 1_000 })
  })
})
