import { test, expect } from '@playwright/test'

test.describe('Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    await page.waitForTimeout(900)
  })

  test('filter panel is hidden on load', async ({ page }) => {
    await expect(page.locator('#filter-panel')).toHaveClass(/hidden/)
  })

  test('clicking filter button shows the filter panel', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    // animateFilterPanelIn: 260ms
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#filter-panel')).toBeVisible()
  })

  test('clicking filter button again hides the filter panel', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#filter-toggle').click()
    // animateFilterPanelOut: 180ms, then hidden class added
    await expect(page.locator('#filter-panel')).toHaveClass(/hidden/, { timeout: 1_000 })
  })

  test('filtering by condition=poor hides non-poor markers', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('.chip[data-filter="condition"][data-value="poor"]').click()
    // Wait for animateMarkersOut to complete (280ms + stagger)
    await page.waitForTimeout(500)

    // Good markers should be animated out (opacity ~0)
    const goodMarkerOpacity = await page.locator('.bench-marker.cond-good').first()
      .evaluate(el => parseFloat(window.getComputedStyle(el).opacity))
    expect(goodMarkerOpacity).toBeLessThan(0.1)
  })

  test('resetting condition to all restores all markers', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    // Apply poor filter then reset
    await page.locator('.chip[data-filter="condition"][data-value="poor"]').click()
    await page.waitForTimeout(500)

    await page.locator('.chip[data-filter="condition"][data-value="all"]').click()
    await page.waitForTimeout(500)

    // All markers should be visible again
    const allOpacities = await page.locator('.bench-marker').evaluateAll(
      els => els.map(el => parseFloat(window.getComputedStyle(el).opacity))
    )
    expect(allOpacities.every(op => op > 0.9)).toBe(true)
  })

  test('backrest filter hides benches without backrest', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#filter-backrest').check()
    await page.waitForTimeout(500)

    // kyoto-central-001 has backrest: false — should be hidden
    const noBackrestOpacity = await page.locator('[data-id="kyoto-central-001"]')
      .evaluate(el => parseFloat(window.getComputedStyle(el).opacity))
    expect(noBackrestOpacity).toBeLessThan(0.1)

    // london-south-005 has backrest: true, condition: poor — should remain visible
    const poorWithBackrestOpacity = await page.locator('[data-id="london-south-005"]')
      .evaluate(el => parseFloat(window.getComputedStyle(el).opacity))
    expect(poorWithBackrestOpacity).toBeGreaterThan(0.9)
  })
})
