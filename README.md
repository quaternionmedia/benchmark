# ⊡ benchmark

A frontend-only, open-source map of benches. Browse, filter, and contribute bench data from around the world.

**[→ View the map](https://your-username.github.io/benchmark)**

---

## Stack

| Layer | Library |
|---|---|
| Map | [Leaflet.js](https://leafletjs.com/) + OpenStreetMap tiles |
| Animations | [anime.js](https://animejs.com/) |
| Data | YAML per region → compiled to GeoJSON at build time |
| Build | [Vite](https://vitejs.dev/) |
| Hosting | GitHub Pages via GitHub Actions |

All open source. No backend. No database. No running costs.

## Quick start

```bash
git clone https://github.com/your-username/benchmark.git
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
| `npm run catalogue` | Regenerate docs/CATALOGUE.md |
| `npm test` | Run Playwright end-to-end tests |

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for how to add benches or submit code changes.

## Docs

- [docs/PHASES.md](docs/PHASES.md) — Project roadmap and milestones
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — Schema reference and contribution guide
- [docs/CATALOGUE.md](docs/CATALOGUE.md) — Auto-generated bench index (run `npm run catalogue`)

## License

MIT
