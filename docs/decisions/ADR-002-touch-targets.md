# ADR-002: 44 px minimum touch targets via `min-height`/`min-width`

**Date:** 2026-03-02
**Status:** Accepted

---

## Context

WCAG 2.5.5 (AA, Level AAA) recommends a minimum touch target size of 44×44 CSS pixels. The benchmark UI had several interactive elements well below this:

| Element | Original size | Issue |
|---|---|---|
| `.btn-icon` header buttons | ~28 px tall (5px + 11px font + 5px = ~21px content, outer with line-height ~30px) | Below 44px |
| `.area-visibility-btn` | 22×22 px explicit | Severe — 50% below minimum |
| `.sidebar-close` | 28×28 px explicit | Below 44px |
| `.chip` filter buttons | ~24 px tall (3px + 11px + 3px) | Below 44px |

On mobile devices (primary use case — people looking for benches while walking), precise taps on 22px buttons are unreliable, and mis-taps waste time.

Three approaches were considered:

**A. Pseudo-element expansion** — Keep the visual element small; use `::before` or `::after` to extend the hit area invisibly beyond the border. Avoids any layout impact.

**B. Padding increase** — Increase padding until the element's total box height reaches 44px. Simple, but can increase header height and cause layout shifts.

**C. `min-height` / `min-width` with `display: inline-flex`** — Set a minimum box size. The element grows to meet the minimum if its natural size is smaller. Visual content (icon/text) is centred via flex.

---

## Decision

Use **option C** (`min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center`).

Rationale:
- Simpler than pseudo-elements — no extra CSS maintenance burden.
- More honest than invisible expansion — the touch target IS the visible element, which also reinforces affordance.
- The header already has `align-items: center` so buttons expanding to 44px vertically is expected and fine. The header's 52px row height accommodates this comfortably.
- The `area-visibility-btn` goes from 22px to 44px — visually the ○/● character stays centred, and the larger hit area inside the areas panel is welcome (no layout impact there).

For `.chip` filter buttons, a `min-height: 36px` (not full 44px) is used as a reasonable compromise — chips are arranged in a row within a scrollable chip group; increasing to 44px would visually dominate the filter panel. The chip group itself scrolls, so users who mis-tap can scroll and retry. 36px is still a significant improvement over 24px.

`touch-action: manipulation` is added to all interactive elements to eliminate the 300ms tap delay on iOS without disabling pinch-zoom on the map.

`-webkit-tap-highlight-color: transparent` removes the default grey flash on tap for elements where we provide our own pressed state (`:active { opacity: 0.7 }`).

---

## Consequences

**Positive:**
- Buttons are reliably tappable on mobile — especially the areas panel visibility toggle.
- No JavaScript changes required.
- `touch-action: manipulation` benefits all touch users: no tap delay on buttons.

**Negative / Trade-offs:**
- Header height visually increases by ~0px (buttons were already vertically centred in 52px row; 44px fits within 52px).
- The areas panel visibility button changing from 22px to 44px means each area row is taller. This is intentional and improves usability.
- Chips at 36px (not 44px) remain slightly below the strict WCAG AAA recommendation. This is a conscious trade-off for panel density.
