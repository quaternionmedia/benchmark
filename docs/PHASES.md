# benchmark — Project Phases

A frontend-only, open-source bench mapping application. Each phase is designed to be independently releasable and incrementally extensible.

---

## Phase 0 — Scaffold `v0.1` ✅

> *"Get the bones in place."*

**Goal:** Working repo with build tooling, basic map rendering, and CI/CD to GitHub Pages.

**Deliverables:**
- Vite project scaffold with vanilla JS
- Leaflet.js map with OpenStreetMap tile layer
- Empty marker layer wired up to GeoJSON
- GitHub Actions deploy workflow publishing to `gh-pages`
- `README.md` and `CONTRIBUTING.md` stubs

**Done when:** A map loads at the GitHub Pages URL with no errors.

---

## Phase 1 — Data Layer `v0.2` ✅

> *"Give the benches a voice."*

**Goal:** Region-grouped YAML files as the canonical data source, compiled to GeoJSON at build time.

**Deliverables:**
- `/public/data/regions/*.yaml` — one file per region
- `scripts/compile-yaml.js` — Node build script that reads all YAML files and emits `benches.geojson`
- Vite plugin hook that runs the compile step before every build
- Schema validation (required fields, coordinate bounds check)
- At least 3 seed regions with 3–5 benches each

**Schema per bench:**
```yaml
id: string          # unique slug
name: string
lat: float
lng: float
material: wood | metal | stone | plastic | concrete | other
backrest: bool
armrests: bool
accessible: bool
condition: good | fair | poor | unknown
seats: int
covered: bool
notes: string       # optional
image_url: string   # optional
added_by: string
added_at: ISO date
```

**Done when:** `npm run build` compiles all YAML to valid GeoJSON and markers appear on the map.

---

## Phase 2 — UI & Animations `v0.3` ✅

> *"Make it feel alive."*

**Goal:** Polished, animated UI powered by anime.js with sidebar, filters, and marker entrance animations.

**Deliverables:**
- Marker entrance animation on map load (staggered fade+scale via anime.js)
- Sidebar panel (bench detail view) with anime.js slide-in/out
- Filter panel with animated show/hide transitions
- Map fly-to animation when a bench is selected (Leaflet `flyTo` + anime.js overlay sync)
- Condition-based marker color coding
- Mobile-responsive layout

**Animation contracts:**
| Trigger | Animation |
|---|---|
| Map load | Cluster badges animate in natively; individual markers appear at full scale (entrance stagger removed in Phase 4 — O(n) bottleneck at scale) |
| Marker click | Map `flyTo`, then sidebar slides in from right |
| Sidebar close | Sidebar slides out, map re-centers |
| Filter toggle | Filter panel fades + translates in from top |
| Filter applied | Cluster group cleared and rebuilt instantly — opacity stagger removed in Phase 4 for O(1) filter performance |

**Done when:** All animations run smoothly at 60fps on mobile.

---

## Phase 3 — Community Contribution `v0.4` ✅

> *"Let the map grow."*

**Goal:** Make it easy for anyone to add a bench via a structured GitHub Issue, and document the full contribution workflow.

**Deliverables:**

- `.github/ISSUE_TEMPLATE/suggest-a-bench.yml` — structured GitHub form with all schema fields
- `.github/ISSUE_TEMPLATE/data-issue.yml` — form for reporting bad or outdated data
- `.github/pull_request_template.md` — PR checklist (coordinate verified, YAML valid, no duplicate ID)
- `scripts/issue-to-yaml.js` — formats an issue response into a ready-to-paste YAML block (`npm run issue-to-yaml`)
- `docs/SCHEMA.md` — full schema reference with enum values, constraints, and examples
- `docs/CONTRIBUTING.md` — fully written contribution guide
- `scripts/generate-catalogue.js` — auto-generates `docs/CATALOGUE.md` from GeoJSON

**Done when:** A non-technical user can open an issue, fill in the form, and a maintainer can merge it in under 5 minutes.

---

## Phase 4 — Discovery & Export `v0.5` ✅

> *"Make the data useful."*

**Goal:** Add search, URL-shareable positions, and data export so power users and researchers can work with the bench data.

**Deliverables:**

- [x] Full-text search across bench names, notes, and region (`src/search.js`) — 200ms debounce, Escape to clear, live count update
- [x] URL hash state (`#lat,lng,zoom`) for shareable map positions (`src/hash.js`) — restores view on load, writes silently via `history.replaceState`
- [x] Export panel: download filtered view as GeoJSON, CSV, or YAML (`src/export.js`)
- [x] Bench count badge updates live when filters or search narrow results
- [x] `Leaflet.markercluster` — clusters nearby markers into count badges; zoom in to expand; batch `addLayers/clearLayers` replaces stagger animations, fixing O(n) filter perf

**Done when:** A user can filter, search, find a bench, share the URL, and download the results.

---

## Phase 5 — Enrichment `v1.0` ✅

> *"Connect to the wider world."*

**Goal:** Optional Overpass API integration to pull OSM bench data, and a heatmap layer for density visualization.

**Deliverables:**

- [x] `scripts/overpass-import.js` — **maintainer tool** that queries Overpass for `amenity=bench` in a named preset area and writes YAML to `public/data/regions/` for review and commit. Use for bulk seeding curated regions only; generated files are not committed automatically.
- [x] `src/store.js` — IndexedDB stale-while-revalidate cache (`loadBenches`, `mergeFeatures`, `clearCache`). `setBenchProvider(fn)` hook lets a future backend replace the IDB+fetch strategy without touching calling code.
- [x] `src/bbox-select.js` — In-app drag-to-draw area importer: user draws a rectangle on the map, app queries Overpass, saves new benches to **IndexedDB** via `mergeFeatures()`, and renders live markers immediately. No YAML files created; no git involvement.
- [x] `src/heatmap.js` + heatmap toggle button — `Leaflet.heat` density layer, toggleable, graceful degradation if plugin unavailable
- [x] `public/manifest.webmanifest` + `public/sw.js` — PWA manifest and service worker (cache-first tiles, network-first shell; GeoJSON bypasses SW so IndexedDB is sole owner)
- [x] `public/icon.svg` — bench silhouette app icon
- [x] Accessibility pass (WCAG 2.1 AA): skip link, `aria-live` bench count, `aria-pressed` on all toggle/chip buttons, `role="group" aria-labelledby` on filter groups, Escape closes sidebar, focus moves to close button on sidebar open

**Data ownership model:**

| Layer | Owner | Committed to git? |
| --- | --- | --- |
| `public/data/regions/*.yaml` | Curated seed data | ✅ (hand-reviewed) |
| `public/data/benches.geojson` | Compiled from YAML at build time | ✅ (build artefact) |
| IndexedDB `benchmark-store` | Browser, per-user | ❌ (never) |
| Overpass imports via bbox tool | Browser IDB only | ❌ (never) |

**Done when:** `v1.0` tag is cut, all phases complete, Lighthouse ≥ 90.

---

## Milestone Summary

| Version | Phase | Theme | Status |
| --- | --- | --- | --- |
| `v0.1` | 0 | Scaffold | ✅ |
| `v0.2` | 1 | Data Layer | ✅ |
| `v0.3` | 2 | UI & Animations | ✅ |
| `v0.4` | 3 | Community | ✅ |
| `v0.5` | 4 | Discovery | ✅ |
| `v1.0` | 5 | Enrichment | ✅ |
