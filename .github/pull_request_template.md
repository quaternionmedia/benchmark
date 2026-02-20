## Summary

<!-- Brief description of what this PR adds or changes -->

---

## Checklist

### For data PRs (new/updated benches)

- [ ] Coordinates verified — I've confirmed them on a map (Google Maps, OSM, or visited in person)
- [ ] `npm run validate` passes with no errors
- [ ] No duplicate `id` values (each ID is unique across all region files)
- [ ] `added_at` is a valid ISO date (`YYYY-MM-DD`)
- [ ] `notes` are under 280 characters (if included)
- [ ] `id` follows the `<region-slug>-<NNN>` convention
- [ ] `material` is one of: `wood`, `metal`, `stone`, `plastic`, `concrete`, `other`
- [ ] `condition` is one of: `good`, `fair`, `poor`, `unknown`

### For code PRs

- [ ] `npm test` passes
- [ ] No new animation calls outside `src/animations.js`
- [ ] CSS uses existing custom properties from `:root`
- [ ] No new external dependencies added without discussion

---

*Closes #<!-- issue number -->*
