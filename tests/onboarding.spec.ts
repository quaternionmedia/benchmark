/**
 * tests/onboarding.spec.ts
 * Verifies the three-stage progressive onboarding:
 *   run 1 → full tooltip visible
 *   run 2 → minimal one-liner visible
 *   run 3 → ping dot on import button (no tooltip)
 *   run 4+ → completely silent
 *
 * Each test seeds localStorage to simulate the desired run count.
 */

import { test, expect } from '@playwright/test'

async function setRuns(page: any, n: number) {
  await page.addInitScript((count: number) => {
    localStorage.setItem('benchmark_onboarding_runs', String(count))
  }, n)
}

async function waitForApp(page: any) {
  await page.goto('.')
  await page.waitForFunction(
    () => document.getElementById('bench-count')?.textContent?.match(/\d+/),
    { timeout: 15_000 }
  )
}

test.describe('Onboarding', () => {
  test('run 1: full tooltip appears and can be dismissed', async ({ page }) => {
    await setRuns(page, 0)
    await waitForApp(page)

    const tip = page.locator('.onboarding-tip')
    await expect(tip).toBeVisible({ timeout: 2_000 })
    // Must mention import or benches
    await expect(tip).toContainText(/import|bench/i)

    // Dismiss via the close button
    await tip.locator('.onboarding-tip-close').click()
    await expect(tip).not.toBeVisible({ timeout: 1_000 })
  })

  test('run 2: minimal one-liner appears', async ({ page }) => {
    await setRuns(page, 1)
    await waitForApp(page)

    const tip = page.locator('.onboarding-tip')
    await expect(tip).toBeVisible({ timeout: 2_000 })
    await expect(tip).toContainText(/import/i)
  })

  test('run 3: ping dot appears on import button, no tooltip', async ({ page }) => {
    await setRuns(page, 2)
    await waitForApp(page)

    // No full tooltip
    await expect(page.locator('.onboarding-tip')).not.toBeVisible({ timeout: 500 })
    // Ping dot should be present briefly
    await expect(page.locator('.toolbar-ping')).toBeAttached({ timeout: 2_000 })
  })

  test('run 4+: completely silent — no tooltip, no ping', async ({ page }) => {
    await setRuns(page, 3)
    await waitForApp(page)
    // Wait long enough that a delayed tip would have appeared
    await page.waitForTimeout(1_000)
    await expect(page.locator('.onboarding-tip')).not.toBeVisible()
    await expect(page.locator('.toolbar-ping')).not.toBeAttached()
  })

  test('localStorage run counter increments on each visit', async ({ page }) => {
    await setRuns(page, 0)
    await waitForApp(page)
    const count = await page.evaluate(() => localStorage.getItem('benchmark_onboarding_runs'))
    expect(Number(count)).toBe(1)
  })
})
