import { test, expect } from '@playwright/test'

// Place the mock position inside Kungsträdgården — within range of all seed benches.
const MOCK_LAT = 59.332
const MOCK_LNG = 18.0717

test.describe('GPS controls', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant geolocation and fix position so both buttons work without a real GPS.
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: MOCK_LAT, longitude: MOCK_LNG })

    await page.goto('.')
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

  test('locate me places a location dot on the map', async ({ page }) => {
    await page.locator('#gps-locate').click()
    // map.locate() → locationfound → _placeLocationDot adds the .gps-dot element
    await expect(page.locator('.gps-dot')).toBeVisible({ timeout: 3_000 })
  })

  test('nearest bench opens the sidebar', async ({ page }) => {
    // Navigate to Stockholm so seed markers are in the viewport and in the registry
    await page.goto('./#59.332,18.0717,14')
    await page.waitForFunction(
      () => (document.getElementById('bench-count')?.textContent?.match(/(\d+)/)?.[1] ?? '0') !== '0',
      { timeout: 15_000 }
    )

    await page.locator('#gps-nearest').click()
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 3_000 })
    await expect(page.locator('#sidebar-content .bench-detail-name')).toBeVisible()
  })
})
