import { test, expect } from '@playwright/test'

// Keyboard navigation and focus management tests.
// Kungsträdgården at zoom 17 — disables clustering so individual markers appear.
const STOCKHOLM_HASH = '#59.332,18.0717,17'

// ─── Skip link ────────────────────────────────────────────────────────────────

test.describe('Skip link', () => {
  test('skip link href targets #main-content', async ({ page }) => {
    await page.goto('.')
    const href = await page.locator('.skip-link').getAttribute('href')
    expect(href).toBe('#main-content')
  })

  test('skip link becomes visible when focused', async ({ page, browserName }) => {
    // Tab navigation requires an active browser window; WebKit mobile emulation
    // (isMobile: true) reports keyboard focus as "inactive" for Tab events.
    // The feature is fully covered by the Chromium project.
    test.skip(browserName === 'webkit', 'Tab key not supported in WebKit mobile emulation')
    await page.goto('.')
    // Tab once from the body — the skip link is the first focusable element
    await page.keyboard.press('Tab')
    await expect(page.locator('.skip-link')).toBeFocused({ timeout: 2_000 })
    // Allow the 100ms CSS transition (top: -100% → 8px) to complete
    await page.waitForTimeout(200)
    // The skip link should now be rendered within the viewport (top: 8px)
    const box = await page.locator('.skip-link').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThan(-1)  // not hidden off-screen
  })

  test('#main-content landmark exists', async ({ page }) => {
    await page.goto('.')
    await expect(page.locator('#main-content')).toBeAttached()
    const tagName = await page.locator('#main-content').evaluate(el => el.tagName.toLowerCase())
    expect(tagName).toBe('main')
  })
})

// ─── ARIA states ──────────────────────────────────────────────────────────────

test.describe('ARIA expanded states', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    await page.waitForFunction(
      () => document.getElementById('bench-count')?.textContent !== '',
      { timeout: 15_000 }
    )
  })

  test('filter toggle starts aria-expanded=false and becomes true on click', async ({ page }) => {
    const btn = page.locator('#filter-toggle')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'false', { timeout: 1_000 })
  })

  test('chip aria-pressed reflects active filter', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    const allChip  = page.locator('.chip[data-filter="condition"][data-value="all"]')
    const poorChip = page.locator('.chip[data-filter="condition"][data-value="poor"]')

    await expect(allChip).toHaveAttribute('aria-pressed', 'true')
    await expect(poorChip).toHaveAttribute('aria-pressed', 'false')

    await poorChip.click()
    await expect(poorChip).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 })
    await expect(allChip).toHaveAttribute('aria-pressed', 'false', { timeout: 1_000 })
  })
})

// ─── Sidebar focus management ────────────────────────────────────────────────

test.describe('Sidebar keyboard accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`./${STOCKHOLM_HASH}`)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bench-count')
        const m = el?.textContent?.match(/(\d+)/)
        return m != null && parseInt(m[1]) > 0
      },
      { timeout: 15_000 }
    )
    await page.waitForFunction(
      () => document.querySelectorAll('.bench-marker').length > 0,
      { timeout: 15_000 }
    )
  })

  test('focus moves to close button when sidebar opens', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    // The sidebar animates in (380ms) and then focuses the close button
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 2_000 })
  })

  test('Tab from close button cycles through sidebar focusable elements', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Tab key not supported in WebKit mobile emulation')
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 2_000 })

    // Tab past the close button — should reach the first directions link
    await page.keyboard.press('Tab')
    const focused1 = await page.evaluate(() => document.activeElement?.className ?? '')
    // The next focusable after close button is a directions link (a.btn-icon.directions-link)
    expect(focused1).toContain('directions-link')
  })

  test('Tab wraps from last sidebar element back to close button', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Tab key not supported in WebKit mobile emulation')
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 2_000 })

    // Tab to first directions link, then to second, then wrap
    await page.keyboard.press('Tab')  // → first link
    await page.keyboard.press('Tab')  // → second link
    await page.keyboard.press('Tab')  // → should wrap to close button
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 1_000 })
  })

  test('Shift+Tab wraps from close button to last sidebar element', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 2_000 })

    // Shift+Tab from close button should wrap to the last focusable (Apple Maps link)
    await page.keyboard.press('Shift+Tab')
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
    expect(focused).toContain('apple maps')
  })

  test('Escape closes sidebar and sidebar gets hidden class', async ({ page }) => {
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 2_000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/, { timeout: 2_000 })
  })

  test('Escape restores focus to the element that opened the sidebar', async ({ page }) => {
    // Focus the first visible marker via keyboard, activate via Enter, then Escape
    const markerEl = page.locator('.bench-marker').first()
    await markerEl.focus()
    await expect(markerEl).toBeFocused({ timeout: 1_000 })

    await page.keyboard.press('Enter')
    await expect(page.locator('#sidebar-close')).toBeFocused({ timeout: 2_000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('#sidebar')).toHaveClass(/hidden/, { timeout: 2_000 })
    // Focus should return to the marker that triggered open
    await expect(markerEl).toBeFocused({ timeout: 1_000 })
  })
})
