# benchmark — Project Phases

A frontend-only, open-source bench mapping application. Each phase is designed to be independently releasable and incrementally extensible.

---

## Phase 0 — Scaffold `v0.1`

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

## Phase 1 — Data Layer `v0.2`

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

## Phase 2 — UI & Animations `v0.3`

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
| Map load | Markers stagger in with `opacity` + `scale` over 600ms |
| Marker click | Map `flyTo`, then sidebar slides in from right |
| Sidebar close | Sidebar slides out, map re-centers |
| Filter toggle | Filter panel fades + translates in from top |
| Filter applied | Non-matching markers animate out (`opacity → 0`, `scale → 0.5`) |

**Done when:** All animations run smoothly at 60fps on mobile.

---

## Phase 3 — Community Contribution `v0.4`

> *"Let the map grow."*

**Goal:** Make it easy for anyone to add a bench via a structured GitHub Issue, and document the full contribution workflow.

**Deliverables:**
- GitHub Issue template: `suggest-a-bench.yml` with all schema fields as form inputs
- `CONTRIBUTING.md` fully written (see contributing docs)
- `scripts/issue-to-yaml.js` — helper script that formats an issue response into a ready-to-paste YAML block
- `docs/SCHEMA.md` — full schema reference
- PR template with checklist (coordinate verified, YAML valid, no duplicate ID)

**Done when:** A non-technical user can open an issue, fill in the form, and a maintainer can merge it in under 5 minutes.

---

## Phase 4 — Discovery & Export `v0.5`

> *"Make the data useful."*

**Goal:** Add search, clustering, and data export so power users and researchers can work with the bench data.

**Deliverables:**
- Full-text search across bench names and notes
- `Leaflet.markercluster` for high-density areas
- URL hash state (`#lat,lng,zoom`) for shareable map positions
- Export panel: download filtered view as GeoJSON, CSV, or YAML
- `scripts/generate-catalogue.js` — generates `docs/CATALOGUE.md` at build time (auto-index of all benches by region)
- Bench count badge in header (animated counter via anime.js)

**Done when:** A user can filter, search, find a bench, share the URL, and download the results.

---

## Phase 5 — Enrichment `v1.0`

> *"Connect to the wider world."*

**Goal:** Optional Overpass API integration to pull OSM bench data, and a heatmap layer for density visualization.

**Deliverables:**
- Overpass query builder for importing OSM benches into YAML format
- `Leaflet.heat` heatmap layer (toggleable)
- PWA manifest + service worker for offline map tiles cache
- Accessibility audit pass (WCAG 2.1 AA)
- Performance budget: Lighthouse score ≥ 90 on mobile

**Done when:** `v1.0` tag is cut, all phases complete, Lighthouse ≥ 90.

---

## Milestone Summary

| Version | Phase | Theme |
|---|---|---|
| `v0.1` | 0 | Scaffold |
| `v0.2` | 1 | Data Layer |
| `v0.3` | 2 | UI & Animations |
| `v0.4` | 3 | Community |
| `v0.5` | 4 | Discovery |
| `v1.0` | 5 | Enrichment |
