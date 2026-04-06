import { test, expect } from '@playwright/test'

// Kungsträdgården — zoom 17 disables clustering (disableClusteringAtZoom: 17)
// so individual bench markers appear in the DOM rather than cluster badges.
const STOCKHOLM_HASH = '#59.332,18.0717,17'

test.describe('Markers', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Stockholm area at zoom 17 where clustering is disabled
    await page.goto(`./${STOCKHOLM_HASH}`)
    // Wait for bench data to load (bench-count animates to a number > 0)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bench-count')
        const m = el?.textContent?.match(/(\d+)/)
        return m != null && parseInt(m[1]) > 0
      },
      { timeout: 15_000 }
    )
    // Wait for at least one individual marker to be visible in the DOM
    await page.waitForFunction(
      () => document.querySelectorAll('.bench-marker').length > 0,
      { timeout: 15_000 }
    )
  })

  test('bench count is greater than zero on load', async ({ page }) => {
    const text = await page.locator('#bench-count').textContent()
    const n = parseInt(text?.match(/(\d+)/)?.[1] ?? '0')
    expect(n).toBeGreaterThan(0)
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

  test('bench count matches number of visible markers', async ({ page }) => {
    const countText = await page.locator('#bench-count').textContent()
    const total = parseInt(countText?.match(/(\d+)/)?.[1] ?? '0')
    const markerCount = await page.locator('.bench-marker').count()
    expect(markerCount).toBe(total)
  })
})
