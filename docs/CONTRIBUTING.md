# Contributing to benchmark

Thank you for helping map the world's benches. This document covers everything you need to add a bench, fix data, or contribute code.

---

## Ways to Contribute

| Type | How |
|---|---|
| Suggest a bench | Open a [Bench Suggestion issue](../../issues/new?template=suggest-a-bench.yml) |
| Fix bench data | Edit the relevant `public/data/regions/*.yaml` and open a PR |
| Add a region | Create a new `public/data/regions/<region-slug>.yaml` file |
| Report bad data | Open a [Data Issue](../../issues/new?template=data-issue.yml) |
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
    added_by: "<your GitHub username>"
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

### 4. Open a Pull Request

Use the PR template checklist. A maintainer will review and merge.

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
| `added_by` | string | ✅ | GitHub username or `community` |
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
| `npm run dev` | Start dev server at `localhost:5173` |
| `npm run build` | Compile YAML → GeoJSON, then build for production |
| `npm run validate` | Validate and compile all YAML files |
| `npm run preview` | Preview the production build locally |
| `npm run catalogue` | Regenerate `docs/CATALOGUE.md` |
| `npm test` | Run Playwright end-to-end tests |

### Build Pipeline

```
public/data/regions/*.yaml
        ↓ scripts/compile-yaml.js  (via Vite plugin on build, or npm run validate for dev)
public/data/benches.geojson
        ↓ Vite build
dist/
```

For local dev, run `npm run validate` once to generate `benches.geojson`, then `npm run dev`.

`benches.geojson` is a generated file — do not edit it directly. Always edit the source YAML.

### Project Structure

```
benchmark/
├── public/
│   └── data/
│       ├── regions/          ← Edit bench data here
│       │   ├── central-park.yaml
│       │   ├── kyoto-central.yaml
│       │   └── london-south.yaml
│       └── benches.geojson   ← Generated, do not edit
├── src/
│   ├── main.js               ← App entry point
│   ├── map.js                ← Leaflet map setup
│   ├── markers.js            ← Marker rendering + filter animations
│   ├── sidebar.js            ← Bench detail sidebar
│   ├── filters.js            ← Filter panel logic
│   └── animations.js         ← anime.js animation contracts
├── scripts/
│   ├── compile-yaml.js       ← YAML → GeoJSON compiler + validator
│   └── generate-catalogue.js ← Auto-generates docs/CATALOGUE.md
├── tests/
│   ├── app.spec.ts           ← App load tests
│   ├── markers.spec.ts       ← Marker rendering tests
│   ├── sidebar.spec.ts       ← Sidebar interaction tests
│   └── filters.spec.ts       ← Filter panel tests
├── docs/
│   ├── PHASES.md             ← Project roadmap
│   ├── CONTRIBUTING.md       ← This file
│   └── CATALOGUE.md          ← Generated bench index
├── deploy.yml                ← GitHub Actions CI/CD
├── playwright.config.ts      ← Playwright test config
├── vite.config.js            ← Vite build config
├── style.css                 ← Application stylesheet
└── index.html
```

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

## Code of Conduct

Be kind. This is a project about benches. There is no reason to be unkind.
