# ⊡ benchmark

A frontend-only, open-source map of benches. Browse, filter, and contribute bench data from around the world.

**[→ View the map](https://quaternionmedia.github.io/benchmark)**

---

## What you can do

- Browse and search benches worldwide by name, region, or notes
- Filter by condition (good / fair / poor), material, and features (backrest, armrests, covered, accessible)
- Use **locate me** to jump to your current position on the map
- Use **nearest bench** to fly to the closest bench from where you are
- Export the current filtered view as GeoJSON, CSV, or YAML
- Import bench areas from the map by drawing a rectangle, polygon, or circle
- Dark mode adapts automatically to your system preference
- Install as an app (PWA) on iOS and Android — works offline

---

## Stack

| Layer | Library |
|---|---|
| Map | [Leaflet.js](https://leafletjs.com/) + [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) + OpenStreetMap tiles |
| Animations | [anime.js](https://animejs.com/) |
| Data | YAML seed regions → GeoJSON at build time; live Overpass import in-browser via IndexedDB |
| Build | [Vite](https://vitejs.dev/) |
| Hosting | GitHub Pages via GitHub Actions |

All open source. No backend. No database. No running costs.

## Quick start

```bash
git clone https://github.com/quaternionmedia/benchmark.git
cd benchmark
npm install
npm run validate   # compile YAML → GeoJSON (required before dev)
npm run dev
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server at localhost:5173 |
| `npm run build` | Compile YAML + build for production |
| `npm run validate` | Validate and compile all YAML files |
| `npm run validate:fix` | Auto-fix minor YAML issues and recompile |
| `npm run catalogue` | Regenerate docs/CATALOGUE.md |
| `npm run overpass-import` | Maintainer tool: bulk-seed a region from Overpass API |
| `npm test` | Run Playwright end-to-end tests |

## Contributing

To add a bench, edit a YAML file in `public/data/regions/` and open a PR — no coding knowledge required. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full guide, including field reference, validation steps, and code contribution workflow.

## Docs

- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — Contribution guide (data + code)
- [docs/PHASES.md](docs/PHASES.md) — Project roadmap and milestones
- [docs/SCHEMA.md](docs/SCHEMA.md) — Full field reference and GeoJSON output format
- [docs/CATALOGUE.md](docs/CATALOGUE.md) — Auto-generated bench index (run `npm run catalogue`)
- [docs/decisions/](docs/decisions/) — Architecture Decision Records (ADRs)

## License

MIT
