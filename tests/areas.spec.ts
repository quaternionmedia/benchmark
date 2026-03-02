import { test, expect } from '@playwright/test'

test.describe('Areas panel', () => {
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

  test('areas panel is hidden on load', async ({ page }) => {
    await expect(page.locator('#areas-panel')).toHaveClass(/hidden/)
  })

  test('clicking areas button shows the areas panel', async ({ page }) => {
    await page.locator('#areas-toggle').click()
    await expect(page.locator('#areas-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#areas-panel')).toBeVisible()
  })

  test('areas panel shows empty-state message when no areas are imported', async ({ page }) => {
    await page.locator('#areas-toggle').click()
    await expect(page.locator('#areas-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    // The list renders asynchronously from IndexedDB; wait for it
    await expect(page.locator('.areas-empty')).toBeVisible({ timeout: 3_000 })
  })

  test('areas panel has accessible region label', async ({ page }) => {
    const panel = page.locator('#areas-panel')
    await expect(panel).toHaveAttribute('role', 'region')
    await expect(panel).toHaveAttribute('aria-label', 'Imported areas')
  })

  test('areas toggle button reflects open state via aria-expanded', async ({ page }) => {
    const btn = page.locator('#areas-toggle')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')

    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 })
  })

  test('clicking areas button again hides the panel', async ({ page }) => {
    await page.locator('#areas-toggle').click()
    await expect(page.locator('#areas-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.locator('#areas-toggle').click()
    await expect(page.locator('#areas-panel')).toHaveClass(/hidden/, { timeout: 1_000 })
  })

  test('pressing Escape closes the areas panel', async ({ page }) => {
    await page.locator('#areas-toggle').click()
    await expect(page.locator('#areas-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('#areas-panel')).toHaveClass(/hidden/, { timeout: 1_000 })
  })
})
