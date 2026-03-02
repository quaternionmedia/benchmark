import { test, expect } from '@playwright/test'

test.describe('Export panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for bench data to load
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bench-count')
        return el !== null && el.textContent !== ''
      },
      { timeout: 15_000 }
    )
  })

  test('export panel is hidden on load', async ({ page }) => {
    await expect(page.locator('#export-panel')).toHaveClass(/hidden/)
  })

  test('clicking export button shows the export panel', async ({ page }) => {
    await page.locator('#export-toggle').click()
    await expect(page.locator('#export-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#export-panel')).toBeVisible()
  })

  test('export panel contains GeoJSON, CSV and YAML download buttons', async ({ page }) => {
    await page.locator('#export-toggle').click()
    await expect(page.locator('#export-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await expect(page.locator('#export-geojson')).toBeVisible()
    await expect(page.locator('#export-csv')).toBeVisible()
    await expect(page.locator('#export-yaml')).toBeVisible()
  })

  test('export panel has accessible region label', async ({ page }) => {
    const panel = page.locator('#export-panel')
    await expect(panel).toHaveAttribute('role', 'region')
    await expect(panel).toHaveAttribute('aria-label', 'Export bench data')
  })

  test('export toggle button reflects open state via aria-expanded', async ({ page }) => {
    const btn = page.locator('#export-toggle')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')

    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 })
  })

  test('clicking export button again hides the panel', async ({ page }) => {
    await page.locator('#export-toggle').click()
    await expect(page.locator('#export-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#export-toggle').click()
    await expect(page.locator('#export-panel')).toHaveClass(/hidden/, { timeout: 1_000 })
  })
})
