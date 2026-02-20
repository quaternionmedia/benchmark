import { test, expect } from '@playwright/test'

test.describe('App load', () => {
  test('loads without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('.')
    // Wait for bench count animation to complete (400ms delay + 900ms duration)
    await expect(page.locator('#bench-count')).toContainText('14', { timeout: 10_000 })

    expect(errors).toHaveLength(0)
  })

  test('bench count displays 14', async ({ page }) => {
    await page.goto('.')
    await expect(page.locator('#bench-count')).toContainText('14', { timeout: 10_000 })
  })

  test('page title is correct', async ({ page }) => {
    await page.goto('.')
    await expect(page).toHaveTitle(/benchmark/)
  })
})
