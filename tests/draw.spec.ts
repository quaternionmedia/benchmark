/**
 * tests/draw.spec.ts
 * Tests for the three draw-to-import modes: rect (bbox), polygon, circle.
 *
 * These tests do NOT make real Overpass requests.  They verify UI state:
 * cursor changes, overlay visibility, polygon vertex accumulation, the
 * floating "close polygon" button, and import-toggle status feedback.
 *
 * Cross-platform notes:
 *   - All drag interactions use page.mouse (pointer events) which work in all
 *     Playwright projects including mobile emulation.
 *   - The toolbar is position:fixed so tests resolve buttons by ID regardless
 *     of viewport size.
 */

import { test, expect } from '@playwright/test'

const STOCKHOLM = '#59.332,18.0717,17'

test.describe('Draw modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`./${STOCKHOLM}`)
    await page.waitForFunction(
      () => (document.getElementById('bench-count')?.textContent?.match(/\d+/)),
      { timeout: 15_000 }
    )
  })

  // ─── Import panel ────────────────────────────────────────────────────────────

  test('import toggle opens the import panel', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#import-panel')).toBeVisible()
  })

  test('import panel has bbox, polygon and circle buttons', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#import-rect')).toBeVisible()
    await expect(page.locator('#import-poly')).toBeVisible()
    await expect(page.locator('#import-circle')).toBeVisible()
  })

  test('opening import panel auto-activates circle mode', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await expect(page.locator('#import-circle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#map')).toHaveClass(/draw-mode/)
  })

  test('import panel closes when import-toggle is clicked again', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).toHaveClass(/hidden/, { timeout: 1_000 })
  })

  test('Escape cancels draw mode and closes panel', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Keyboard events not reliable in WebKit mobile emulation')
    await page.locator('#import-toggle').click()
    await expect(page.locator('#map')).toHaveClass(/draw-mode/, { timeout: 500 })
    await page.keyboard.press('Escape')
    await expect(page.locator('#map')).not.toHaveClass(/draw-mode/, { timeout: 500 })
    await expect(page.locator('#import-panel')).toHaveClass(/hidden/, { timeout: 500 })
  })

  // ─── Rect / bbox ─────────────────────────────────────────────────────────────

  test('selecting bbox mode enters draw mode and sets aria-pressed', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await page.locator('#import-rect').click()
    await expect(page.locator('#import-rect')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#map')).toHaveClass(/draw-mode/)
  })

  test('dragging on map in rect mode draws a rectangle overlay', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await page.locator('#import-rect').click()
    await expect(page.locator('#map')).toHaveClass(/draw-mode/)

    const mapBox = await page.locator('#map').boundingBox()
    if (!mapBox) throw new Error('map not found')

    // Drag a rectangle in the centre of the map
    const cx = mapBox.x + mapBox.width  * 0.3
    const cy = mapBox.y + mapBox.height * 0.3
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 80, cy + 60, { steps: 8 })

    // A Leaflet SVG rectangle should appear while dragging
    await expect(page.locator('.import-drawing')).toBeAttached({ timeout: 1_000 })

    await page.mouse.up()
    // After release, draw mode exits and map returns to normal
    await expect(page.locator('#map')).not.toHaveClass(/draw-mode/, { timeout: 1_000 })
  })

  // ─── Circle ──────────────────────────────────────────────────────────────────

  test('selecting circle mode enters draw mode', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    // Circle is auto-activated; click it again to deactivate (panel stays open for mode selection)
    await page.locator('#import-circle').click()   // deactivate
    await expect(page.locator('#map')).not.toHaveClass(/draw-mode/, { timeout: 500 })
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 500 })
    await page.locator('#import-circle').click()   // re-activate
    await expect(page.locator('#import-circle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#map')).toHaveClass(/draw-mode/)
  })

  test('dragging on map in circle mode draws a circle overlay', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    // Circle is already active
    await expect(page.locator('#map')).toHaveClass(/draw-mode/)

    const mapBox = await page.locator('#map').boundingBox()
    if (!mapBox) throw new Error('map not found')

    const cx = mapBox.x + mapBox.width  * 0.4
    const cy = mapBox.y + mapBox.height * 0.4

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    // Drag outward to create a visible radius
    await page.mouse.move(cx + 60, cy, { steps: 10 })

    // A Leaflet circle path should appear
    await expect(page.locator('.import-drawing')).toBeAttached({ timeout: 1_000 })

    await page.mouse.up()
    // After release, draw mode exits
    await expect(page.locator('#map')).not.toHaveClass(/draw-mode/, { timeout: 2_000 })
  })

  test('tiny circle tap keeps draw mode active (does not cancel)', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#map')).toHaveClass(/draw-mode/, { timeout: 500 })

    const mapBox = await page.locator('#map').boundingBox()
    if (!mapBox) throw new Error('map not found')

    // Tap without dragging (radius = 0 → < 30 m threshold)
    const cx = mapBox.x + mapBox.width * 0.5
    const cy = mapBox.y + mapBox.height * 0.5
    await page.mouse.click(cx, cy)

    // Draw mode must survive a tiny tap — user gets another chance
    await expect(page.locator('#map')).toHaveClass(/draw-mode/, { timeout: 500 })
  })

  // ─── Polygon ─────────────────────────────────────────────────────────────────

  test('selecting polygon mode enters draw mode', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await page.locator('#import-poly').click()
    await expect(page.locator('#import-poly')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#map')).toHaveClass(/draw-mode/)
  })

  test('clicking on map in polygon mode adds vertices and shows polyline', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await page.locator('#import-poly').click()
    await expect(page.locator('#map')).toHaveClass(/draw-mode/)

    const mapBox = await page.locator('#map').boundingBox()
    if (!mapBox) throw new Error('map not found')

    const cx = mapBox.x + mapBox.width  * 0.35
    const cy = mapBox.y + mapBox.height * 0.35

    // Place two vertices — no "close" button yet
    await page.mouse.click(cx,       cy)
    await page.mouse.click(cx + 60,  cy)
    await expect(page.locator('.poly-done-btn')).not.toBeVisible()

    // Third vertex — "close polygon" button should appear
    await page.mouse.click(cx + 60,  cy + 50)
    await expect(page.locator('.poly-done-btn')).toBeVisible({ timeout: 500 })
  })

  test('"close polygon" button finishes the polygon and exits draw mode', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await page.locator('#import-poly').click()

    const mapBox = await page.locator('#map').boundingBox()
    if (!mapBox) throw new Error('map not found')

    const cx = mapBox.x + mapBox.width  * 0.35
    const cy = mapBox.y + mapBox.height * 0.35

    // Place 3 vertices
    await page.mouse.click(cx,       cy)
    await page.mouse.click(cx + 70,  cy)
    await page.mouse.click(cx + 35,  cy + 50)
    await expect(page.locator('.poly-done-btn')).toBeVisible({ timeout: 500 })

    // Click "close polygon"
    await page.locator('.poly-done-btn').click()

    // Draw mode exits; button hides; import-toggle shows querying status
    await expect(page.locator('#map')).not.toHaveClass(/draw-mode/, { timeout: 1_000 })
    await expect(page.locator('.poly-done-btn')).not.toBeVisible({ timeout: 500 })
  })

  test('Escape while drawing polygon hides the done button', async ({ page }) => {
    await page.locator('#import-toggle').click()
    await expect(page.locator('#import-panel')).not.toHaveClass(/hidden/, { timeout: 1_000 })
    await page.locator('#import-poly').click()

    const mapBox = await page.locator('#map').boundingBox()
    if (!mapBox) throw new Error('map not found')

    const cx = mapBox.x + mapBox.width  * 0.35
    const cy = mapBox.y + mapBox.height * 0.35

    await page.mouse.click(cx,      cy)
    await page.mouse.click(cx + 60, cy)
    await page.mouse.click(cx + 60, cy + 50)
    await expect(page.locator('.poly-done-btn')).toBeVisible({ timeout: 500 })

    await page.keyboard.press('Escape')
    await expect(page.locator('.poly-done-btn')).not.toBeVisible({ timeout: 500 })
    await expect(page.locator('#map')).not.toHaveClass(/draw-mode/, { timeout: 500 })
  })

  // ─── Import status on toolbar button ─────────────────────────────────────────

  test('import toggle button text is "import" by default', async ({ page }) => {
    await expect(page.locator('#import-toggle')).toHaveText('import')
  })

  // ─── Landscape layout ────────────────────────────────────────────────────────

  test('toolbar buttons are reachable in landscape 667×375', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 })
    // All toolbar buttons must still be visible (position:fixed)
    for (const id of ['#filter-toggle', '#import-toggle', '#export-toggle', '#areas-toggle', '#gps-locate', '#gps-nearest']) {
      await expect(page.locator(id)).toBeVisible()
    }
    // Toolbar must not overflow viewport height
    const toolbarBox = await page.locator('#toolbar').boundingBox()
    expect(toolbarBox).not.toBeNull()
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(375 + 1)
  })

  // ─── Map height ──────────────────────────────────────────────────────────────

  test('map does not extend behind the fixed toolbar', async ({ page }) => {
    const mapBox     = await page.locator('#map').boundingBox()
    const toolbarBox = await page.locator('#toolbar').boundingBox()
    expect(mapBox).not.toBeNull()
    expect(toolbarBox).not.toBeNull()
    // Map bottom edge must be at or above the toolbar top edge
    expect(mapBox!.y + mapBox!.height).toBeLessThanOrEqual(toolbarBox!.y + 2)
  })
})
