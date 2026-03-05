import { test, expect } from '@playwright/test'

// Kungsträdgården — zoom 17 disables clustering so individual markers are
// visible in the DOM without needing to click a cluster first.
const STOCKHOLM_HASH = '#59.332,18.0717,17'

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`./${STOCKHOLM_HASH}`)
    // Wait for bench data to load
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bench-count')
        const m  = el?.textContent?.match(/(\d+)/)
        return m !== null && parseInt(m[1]) > 0
      },
      { timeout: 15_000 }
    )
    // Wait for individual bench markers to appear in the DOM
    await page.waitForFunction(
      () => document.querySelectorAll('.bench-marker').length > 0,
      { timeout: 15_000 }
    )
  })

  test('sidebar is hidden on load', async ({ page }) => {
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/)
  })

  test('clicking a marker opens the sidebar', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    // Sidebar animates in (380ms)
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })
    await expect(page.locator('#sidebar-content .bench-detail-name')).toBeVisible()
  })

  test('sidebar shows correct bench data for stockholm-demo-001', async ({ page }) => {
    // Molin's Fountain Bench — the first seed bench, individually visible at zoom 17
    await page.locator('[data-id="stockholm-demo-001"]').dispatchEvent('click')
    await expect(page.locator('#sidebar-content')).toContainText("Molin's Fountain Bench", { timeout: 2_000 })
    await expect(page.locator('#sidebar-content')).toContainText('Stockholm')
    await expect(page.locator('#sidebar-content')).toContainText('good')
    await expect(page.locator('#sidebar-content')).toContainText('metal')
    await expect(page.locator('#sidebar-content')).toContainText('3')
  })

  test('sidebar shows directions links after opening', async ({ page }) => {
    await page.locator('[data-id="stockholm-demo-001"]').dispatchEvent('click')
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })
    // Both directions links must be present and point to the right services
    const googleLink = page.locator('.directions-link').filter({ hasText: 'directions' })
    const appleLink  = page.locator('.directions-link').filter({ hasText: 'apple maps' })
    await expect(googleLink).toBeVisible()
    await expect(appleLink).toBeVisible()
    const googleHref = await googleLink.getAttribute('href')
    const appleHref  = await appleLink.getAttribute('href')
    expect(googleHref).toContain('google.com/maps')
    expect(appleHref).toContain('maps.apple.com')
  })

  test('closing sidebar hides it', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })

    await page.locator('#sidebar-close').click()
    // Sidebar animates out (280ms), then hidden class is re-applied
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/, { timeout: 2_000 })
  })

  test('pressing Escape closes an open sidebar', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Focus management unreliable in WebKit mobile emulation')
    await page.locator('.bench-marker').first().dispatchEvent('click')
    // Wait for the sidebar-open animation to complete — the app focuses the
    // close button at animation end, which also sets isOpen = true.  Pressing
    // Escape before this point would be a no-op because isOpen is still false.
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 1_000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/, { timeout: 2_000 })
  })
})
