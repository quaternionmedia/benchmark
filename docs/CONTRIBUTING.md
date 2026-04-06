# Contributing to benchmark

Thank you for helping map the world's benches. This document covers everything you need to add a bench, fix data, or contribute code.

---

## Ways to Contribute

| Type | How |
|---|---|
| Add a bench | Edit the relevant `public/data/regions/*.yaml` and open a PR |
| Add a region | Create a new `public/data/regions/<region-slug>.yaml` file |
| Code contributions | See [Development](#development) below |

---

## Adding a Bench via YAML

All bench data lives in `public/data/regions/`. Each file covers one geographic region (city, borough, park, etc.).

### 1. Find or create the right region file

Region files are named by slug: `london-south.yaml`, `kyoto-central.yaml`, `central-park.yaml`.

If no region file exists yet, create one:

```yaml
# public/data/regions/my-city-area.yaml
region:
  name: "My City Area"
  description: "Optional description of this area"

benches:
  - id: myarea-001
    name: "Park Entrance Bench"
    lat: 51.5074
    lng: -0.1278
    # ... rest of fields
```

### 2. Add your bench entry

Append to the `benches:` list in the appropriate region file. Copy this template:

```yaml
  - id: <region-slug>-<NNN>          # e.g. london-south-007
    name: "<Descriptive name>"
    lat: <decimal latitude>
    lng: <decimal longitude>
    material: wood                    # wood | metal | stone | plastic | concrete | other
    backrest: true                    # true | false
    armrests: false                   # true | false
    accessible: false                 # true | false | null (unknown)
    condition: good                   # good | fair | poor | unknown
    seats: 2                          # integer
    covered: false                    # true | false
    added_by: "<your name or 'community'>"
    added_at: "2025-01-01"            # ISO date YYYY-MM-DD
    notes: ""                         # optional, keep under 280 chars
    image_url: null                   # optional URL to a photo
```

### 3. Validate your YAML

Run the validator before opening a PR:

```bash
npm run validate
```

This checks:
- Required fields are present
- `id` is unique across all regions
- Coordinates are valid (lat −90→90, lng −180→180)
- Enum values match the schema
- `added_at` is a valid ISO date

### 4. Fork, branch, and open a Pull Request

If you don't have write access to the repo:

1. **Fork** the repository on GitHub (click "Fork" in the top-right)
2. **Clone** your fork: `git clone https://github.com/<your-username>/benchmark.git`
3. **Create a branch**: `git checkout -b data/add-my-bench`
4. Make your changes, run `npm run validate`
5. **Commit** with a descriptive message: `git commit -m "data: add bench at Hyde Park Corner"`
6. **Push** your branch: `git push -u origin data/add-my-bench`
7. Open a **Pull Request** from your fork's branch to `quaternionmedia/benchmark:main`

PR checklist:
- [ ] `npm run validate` passes with no errors
- [ ] Commit message follows the convention (`feat:`, `fix:`, `data:`, `docs:`, `chore:`)
- [ ] For code contributions: `npm test` passes

---

## Schema Reference

### Region File Structure

```yaml
region:
  name: string          # Human-readable region name (required)
  description: string   # Optional region description

benches:
  - <BenchEntry>
  - <BenchEntry>
```

### Bench Entry Fields

| Field | Type | Required | Values |
|---|---|---|---|
| `id` | string | ✅ | Unique slug: `<region>-<NNN>` |
| `name` | string | ✅ | Human-readable name |
| `lat` | float | ✅ | Decimal latitude (−90 to 90) |
| `lng` | float | ✅ | Decimal longitude (−180 to 180) |
| `material` | enum | ✅ | `wood` `metal` `stone` `plastic` `concrete` `other` |
| `backrest` | bool | ✅ | `true` or `false` |
| `armrests` | bool | ✅ | `true` or `false` |
| `accessible` | bool/null | ✅ | `true`, `false`, or `null` (unknown) |
| `condition` | enum | ✅ | `good` `fair` `poor` `unknown` |
| `seats` | int | ✅ | Number of seats (1–20) |
| `covered` | bool | ✅ | `true` or `false` |
| `added_by` | string | ✅ | Your name, handle, or `community` |
| `added_at` | string | ✅ | ISO 8601 date: `YYYY-MM-DD` |
| `notes` | string | ❌ | Max 280 characters |
| `image_url` | string | ❌ | Full URL to image, `null` if none |

### Condition Guide

| Value | Meaning |
|---|---|
| `good` | Clean, structurally sound, no visible damage |
| `fair` | Minor wear, still fully functional |
| `poor` | Damaged, missing parts, or unsafe |
| `unknown` | Not assessed in person |

---

## Development

### Prerequisites

- Node.js 20+
- npm 9+

### Setup

```bash
git clone https://github.com/quaternionmedia/benchmark.git
cd benchmark
npm install
```

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at `localhost:8347` |
| `npm run build` | Compile YAML → GeoJSON, then build for production |
| `npm run validate` | Validate and compile all YAML files |
| `npm run preview` | Preview the production build locally |
| `npm run catalogue` | Regenerate `docs/CATALOGUE.md` |
| `npm test` | Run all Playwright end-to-end tests |

### Build Pipeline

```
public/data/regions/*.yaml
        ↓ scripts/compile-yaml.js  (via Vite plugin on build, or npm run validate for dev)
public/data/benches.geojson
        ↓ Vite build
dist/
```

For local dev, just run `npm run dev` — the Vite plugin compiles any YAML regions automatically at startup. If there are no YAML files, `benches.geojson` will be empty and benches load live from Overpass on page load.

`benches.geojson` is a generated file — do not edit it directly. Always edit the source YAML.

### Project Structure

```
benchmark/
├── public/
│   └── data/
│       ├── regions/            ← Hand-curated bench YAML files (optional)
│       └── benches.geojson     ← Compiled from YAML (empty if no regions)
├── src/
│   ├── main.js                 ← App entry point; wires all modules
│   ├── map.js                  ← Leaflet map init and flyTo
│   ├── markers.js              ← Custom marker rendering + clustering
│   ├── sidebar.js              ← Bench detail panel + focus management
│   ├── filters.js              ← Filter panel chips and predicates
│   ├── search.js               ← Full-text search with debounce
│   ├── gps.js                  ← GPS locate + nearest bench
│   ├── areas.js                ← Imported area manager panel
│   ├── export.js               ← GeoJSON / CSV / YAML download
│   ├── hash.js                 ← URL hash state (#lat,lng,zoom)
│   ├── store.js                ← IndexedDB stale-while-revalidate cache
│   ├── animations.js           ← All anime.js animation contracts
│   └── bbox-select.js          ← Rect / polygon / circle draw tools
├── scripts/
│   ├── compile-yaml.js         ← YAML → GeoJSON compiler + validator
│   └── generate-catalogue.js   ← Auto-generates docs/CATALOGUE.md
├── tests/
│   ├── app.spec.ts             ← App load, title, bench count
│   ├── markers.spec.ts         ← Marker rendering and condition classes
│   ├── sidebar.spec.ts         ← Sidebar open/close, content, directions
│   ├── filters.spec.ts         ← Filter chips, checkboxes, count updates
│   ├── search.spec.ts          ← Full-text search filtering
│   ├── gps.spec.ts             ← GPS locate and nearest bench
│   ├── export.spec.ts          ← Export panel visibility and buttons
│   ├── areas.spec.ts           ← Areas panel visibility and empty state
│   ├── keyboard.spec.ts        ← Focus management and focus trap
│   └── mobile.spec.ts          ← Layout and touch targets at 375 px
├── docs/
│   ├── PHASES.md               ← Project roadmap
│   ├── CONTRIBUTING.md         ← This file
│   ├── SCHEMA.md               ← Full field reference
│   ├── CATALOGUE.md            ← Generated bench index
│   └── decisions/              ← Architecture Decision Records (ADRs)
├── .github/
│   └── workflows/
│       └── deploy.yml          ← GitHub Actions CI/CD
├── playwright.config.ts        ← Playwright test config
├── vite.config.js              ← Vite build config
├── style.css                   ← Application stylesheet
└── index.html
```

### Writing and running tests

Tests live in `tests/` and use [Playwright](https://playwright.dev/). The dev server must be running (or Playwright will start it automatically via `webServer` in `playwright.config.ts`).

**Run all tests:**
```bash
npm test
```

**Run a single spec:**
```bash
npx playwright test tests/sidebar.spec.ts
```

**Run only mobile tests:**
```bash
npx playwright test tests/mobile.spec.ts --project=mobile-chrome
```

**Common pattern for a new test:**

```typescript
import { test, expect } from '@playwright/test'

test.describe('My feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
    // Wait for data to load before interacting
    await page.waitForFunction(
      () => document.getElementById('bench-count')?.textContent !== '',
      { timeout: 15_000 }
    )
  })

  test('something works', async ({ page }) => {
    await page.locator('#some-button').click()
    await expect(page.locator('#some-result')).toBeVisible()
  })
})
```

Key patterns used in the test suite:
- Load data by waiting for `#bench-count` to contain text (not just be present)
- Navigate to `#59.332,18.0717,17` (Stockholm, zoom 17) to disable clustering and see individual markers
- Use `dispatchEvent('click')` on `.bench-marker` elements to avoid Leaflet event interception
- Wait for `#sidebar-close` to be focused before testing keyboard behavior in the sidebar

---

## Code Style

- Vanilla JS (ES modules, no TypeScript for now)
- Prefer named exports
- Animation logic stays in `src/animations.js` — keep anime.js calls centralized
- CSS custom properties for all colors and spacing
- No external CSS frameworks — hand-rolled styles only

---

## Commit Convention

```
feat: add bench detail sidebar animation
fix: correct coordinate validation bounds
data: add 3 benches to london-south region
docs: update schema with image_url field
chore: bump leaflet to 1.9.4
```

---

## Troubleshooting

**`npm install` fails**
Check your Node version: `node -v`. Requires Node 20+. If you have an older version, use [nvm](https://github.com/nvm-sh/nvm) to switch: `nvm install 20 && nvm use 20`.

**`npm run validate` errors**
YAML is whitespace-sensitive. Common issues:
- Indentation must be 2 spaces (no tabs)
- Boolean values: `true` / `false` (not `yes` / `no`)
- ID must be unique across all region files — the validator will tell you which ID is duplicated

**Dev server shows "0 benches" briefly on load**
The app auto-imports benches from Overpass on every page load. The count starts at 0 and fills in once the query resolves (~1–3 s on a good connection). If it stays at 0, check your network connection or the browser console for Overpass errors. If you have hand-curated YAML files, run `npm run validate` first to include them in the static seed.

**Tests fail with timeout errors**
Make sure the dev server is running in a separate terminal (`npm run dev`) before running `npm test`. Playwright will try to start it automatically, but if port 8347 is already in use by something else, the server will fail silently.

**Playwright can't find a browser**
Run `npx playwright install chromium` to download the bundled browser. If you want all browsers: `npx playwright install`.

**The sidebar doesn't open when I click a marker in tests**
Use `dispatchEvent('click')` instead of `.click()` — Leaflet intercepts native pointer events on the map container, so synthetic events dispatched directly on the marker div are more reliable.

---

## Code of Conduct

Be kind. This is a project about benches. There is no reason to be unkind.
