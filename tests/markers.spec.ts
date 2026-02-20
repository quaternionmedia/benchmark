import { test, expect } from '@playwright/test'

test.describe('Markers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for marker animation: 200ms delay + 480ms animation
    await page.waitForTimeout(900)
  })

  test('all 14 markers are present in the DOM', async ({ page }) => {
    const markers = page.locator('.bench-marker')
    await expect(markers).toHaveCount(14)
  })

  test('markers have correct condition classes', async ({ page }) => {
    // Central Park: 3 good (cp-001, cp-002, cp-003), 1 fair (cp-004)
    // Kyoto Central: 3 good (kc-001, kc-003, kc-004), 1 fair (kc-002), 1 unknown (kc-005)
    // London South: 3 good (ls-001, ls-003, ls-004), 1 fair (ls-002), 1 poor (ls-005)
    // Total: 9 good, 3 fair, 1 poor, 1 unknown
    await expect(page.locator('.bench-marker.cond-good')).toHaveCount(9)
    await expect(page.locator('.bench-marker.cond-fair')).toHaveCount(3)
    await expect(page.locator('.bench-marker.cond-poor')).toHaveCount(1)
    await expect(page.locator('.bench-marker.cond-unknown')).toHaveCount(1)
  })

  test('markers are visible after animation completes', async ({ page }) => {
    const firstMarker = page.locator('.bench-marker').first()
    const opacity = await firstMarker.evaluate(el =>
      parseFloat(window.getComputedStyle(el).opacity)
    )
    expect(opacity).toBeGreaterThan(0.9)
  })
})
