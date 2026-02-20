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
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#filter-panel')).toBeVisible()
  })

  test('clicking filter button again hides the filter panel', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).toHaveClass(/hidden/, { timeout: 1_000 })
  })

  test('filtering by condition=poor hides non-poor markers', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('.chip[data-filter="condition"][data-value="poor"]').click()

    // Poll until a good marker is animated out (animateMarkersOut: 280ms + stagger)
    await page.waitForFunction(() => {
      const el = document.querySelector('.bench-marker.cond-good')
      return el !== null && parseFloat(window.getComputedStyle(el).opacity) < 0.1
    }, { timeout: 5_000 })
  })

  test('resetting condition to all restores all markers', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('.chip[data-filter="condition"][data-value="poor"]').click()
    await page.waitForFunction(() => {
      const el = document.querySelector('.bench-marker.cond-good')
      return el !== null && parseFloat(window.getComputedStyle(el).opacity) < 0.1
    }, { timeout: 5_000 })

    await page.locator('.chip[data-filter="condition"][data-value="all"]').click()

    // Poll until all 14 markers are restored (animateMarkersVisible: 340ms + stagger)
    await page.waitForFunction(() => {
      const markers = document.querySelectorAll('.bench-marker')
      return markers.length > 0 &&
        Array.from(markers).every(el => parseFloat(window.getComputedStyle(el).opacity) > 0.9)
    }, { timeout: 5_000 })
  })

  test('backrest filter hides benches without backrest', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#filter-backrest').check()

    // kyoto-central-001 (backrest: false) must be animated out
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-id="kyoto-central-001"]')
      return el !== null && parseFloat(window.getComputedStyle(el).opacity) < 0.1
    }, { timeout: 5_000 })

    // london-south-005 (backrest: true, condition: poor) must be visible
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-id="london-south-005"]')
      return el !== null && parseFloat(window.getComputedStyle(el).opacity) > 0.9
    }, { timeout: 5_000 })
  })
})
