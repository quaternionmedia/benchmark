import { test, expect } from '@playwright/test'

// Mobile layout and touch-target tests.
// Runs in all projects but forces a 375×667 viewport (iPhone SE size).
// This covers the narrowest common phone form factor.
test.use({ viewport: { width: 375, height: 667 } })

// Skip in desktop chromium — the dedicated mobile-chrome/mobile-safari projects
// run this with a device User-Agent; chromium with a forced 375px viewport tests
// the layout logic without a mobile UA, which is still valuable.
const STOCKHOLM_HASH = '#59.332,18.0717,17'

test.describe('Mobile layout (375 × 667)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    await page.waitForFunction(
      () => {
        const el = document.getElementById('bench-count')
        return el !== null && el.textContent !== ''
      },
      { timeout: 15_000 }
    )
  })

  // ─── Layout integrity ──────────────────────────────────────────────────────

  test('no user-visible horizontal scroll at 375 px', async ({ page }) => {
    // body { overflow: hidden } clips content so no scrollbar can appear.
    // clientWidth (unlike scrollWidth) reflects the rendered clip boundary.
    const [innerWidth, bodyClientWidth] = await page.evaluate(() => [
      window.innerWidth,
      document.body.clientWidth
    ])
    expect(bodyClientWidth).toBeLessThanOrEqual(innerWidth)
  })

  test('key header controls are visible', async ({ page }) => {
    await expect(page.locator('#filter-toggle')).toBeVisible()
    await expect(page.locator('#gps-locate')).toBeVisible()
    await expect(page.locator('#gps-nearest')).toBeVisible()
  })

  test('bench count element is visible', async ({ page }) => {
    await expect(page.locator('#bench-count')).toBeVisible()
  })

  test('map fills the viewport below the header', async ({ page }) => {
    const mapBox = await page.locator('#map').boundingBox()
    expect(mapBox).not.toBeNull()
    expect(mapBox!.width).toBeGreaterThan(300)
    expect(mapBox!.height).toBeGreaterThan(400)
  })

  // ─── Touch targets ────────────────────────────────────────────────────────

  test('toolbar buttons meet 44 px minimum height', async ({ page }) => {
    // Buttons now live in the fixed toolbar (not the header)
    const buttons = ['#filter-toggle', '#export-toggle', '#areas-toggle', '#gps-locate', '#gps-nearest']
    for (const selector of buttons) {
      const box = await page.locator(selector).boundingBox()
      expect(box, `${selector} height`).not.toBeNull()
      expect(box!.height, `${selector} should be ≥ 44px`).toBeGreaterThanOrEqual(44)
    }
  })

  test('map bottom edge does not overlap the fixed toolbar', async ({ page }) => {
    const mapBox     = await page.locator('#map').boundingBox()
    const toolbarBox = await page.locator('#toolbar').boundingBox()
    expect(mapBox).not.toBeNull()
    expect(toolbarBox).not.toBeNull()
    expect(mapBox!.y + mapBox!.height).toBeLessThanOrEqual(toolbarBox!.y + 2)
  })

  // ─── Filter panel ────────────────────────────────────────────────────────

  test('filter panel opens and is usable at 375 px', async ({ page }) => {
    await page.locator('#filter-toggle').click()
    await expect(page.locator('#filter-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#filter-panel')).toBeVisible()
    // At least one chip should be visible
    await expect(page.locator('.chip').first()).toBeVisible()
  })

  // ─── Sidebar ─────────────────────────────────────────────────────────────

  test('sidebar opens to full viewport width at 375 px', async ({ page }) => {
    await page.goto(`./${STOCKHOLM_HASH}`)
    await page.waitForFunction(
      () => document.querySelectorAll('.bench-marker').length > 0,
      { timeout: 15_000 }
    )
    await page.locator('.bench-marker').first().dispatchEvent('click')
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/, { timeout: 2_000 })

    const sidebarBox = await page.locator('#sidebar').boundingBox()
    expect(sidebarBox).not.toBeNull()
    // On mobile, --sidebar-w = 100vw, so width should equal the viewport
    expect(sidebarBox!.width).toBeGreaterThanOrEqual(370)  // allow 5px rounding
  })

  // ─── Export panel ────────────────────────────────────────────────────────

  test('export panel opens to full viewport width at 375 px', async ({ page }) => {
    await page.locator('#export-toggle').click()
    await expect(page.locator('#export-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })

    const panelBox = await page.locator('#export-panel').boundingBox()
    expect(panelBox).not.toBeNull()
    expect(panelBox!.width).toBeGreaterThanOrEqual(370)
  })

  // ─── Accessibility landmarks on mobile ────────────────────────────────────

  test('main landmark exists and contains the map', async ({ page }) => {
    const mainEl = page.locator('#main-content')
    await expect(mainEl).toBeAttached()
    const mapEl = page.locator('#main-content #map')
    await expect(mapEl).toBeAttached()
  })
})
