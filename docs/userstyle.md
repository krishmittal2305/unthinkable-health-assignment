# Frontend Design System — Swiss Minimal

Reference spec for restyling the frontend. This is a specification only — no application code has been
changed to match it yet.

ABSOLUTELY NO USE OF GRADIENT ANYWHERE.

## Design philosophy

Swiss / International Typographic Style: objective, grid-based, functional. Structure and typography do
the work, not decoration. Concretely:

- Strong typographic hierarchy — size and weight contrast carry meaning, not color-for-decoration
- Grid alignment — consistent margins, consistent column widths, elements line up
- Generous whitespace — let sections breathe instead of packing content tightly
- Flat surfaces — no gradients, no drop shadows, no glow/blur effects
- Hairline rules over boxes — a 1px border or divider line separates sections more often than a
  card-with-shadow does
- Sharp or barely-rounded corners (0–4px radius) — this is not a soft/glassy UI
- Color is functional, not ambient — an accent color marks status or action, it doesn't decorate a
  background for its own sake

## Base palette

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#000000` | Page background |
| `--surface` | `#121212` | Slightly raised surface (cards, panels) — still near-black, never a lighter "card gray" that looks like a different material |
| `--text` | `#FFFFFF` | Primary text |
| `--text-muted` | `#A3A3A3` | Secondary/muted text — still legible on black, not low-contrast decoration |
| `--border` | `#2A2A2A` | Hairline dividers and input borders |

Pure black background, pure white primary text. Do not substitute an off-black/off-white "softened"
palette — the brief is specifically black/white with color doing the accent work.

## Accent colors

Flat, saturated, poster-like — not pastel, not neon-glow. Each has a default semantic role; reassign as
needed but keep the mapping consistent once chosen.

| Color | Value | Suggested role |
|---|---|---|
| Blue | `#2563FF` | Primary action, links, informational |
| Red | `#E8342A` | Error, destructive action, high urgency |
| Pink | `#FF2D78` | Highlight, special/featured state |
| Green | `#1FAA59` | Success, confirmed, low urgency |
| Yellow | `#FFC400` | Warning, medium urgency, pending |
| Orange | `#FF6B00` | Secondary warning, in-progress |

These are starting values tuned for contrast against `#000000` — verify actual contrast ratios (WCAG AA,
4.5:1 for text) if the exact hex values change.

## Pills, badges, and cards — the rule

**Never use a semi-transparent tint of the accent color as a background with same-hue text on top**
(e.g. `rgba(37, 99, 255, 0.15)` background with blue text). That pattern reads as low-contrast and
washed-out, and is explicitly not wanted here.

Instead: **solid, full-opacity accent background** with a solid, high-contrast text color on top.

| Background | Text color | Why |
|---|---|---|
| Blue `#2563FF` | White `#FFFFFF` | Dark enough for white text |
| Red `#E8342A` | White `#FFFFFF` | Dark enough for white text |
| Pink `#FF2D78` | White `#FFFFFF` | Dark enough for white text |
| Green `#1FAA59` | White `#FFFFFF` | Dark enough for white text |
| Orange `#FF6B00` | White `#FFFFFF` (or `#111111` if contrast checks fail) | Verify contrast — mid-brightness |
| Yellow `#FFC400` | Black `#000000` | Yellow is light; black text is required for contrast, white will not pass |

This applies to every solid-fill UI element: status pills, urgency badges, notification dots with a label,
filled buttons, tags. Outline/ghost variants (transparent background, colored border and text) are fine
as a secondary style, but the default/filled variant must be solid-background.

## Typography

- Font stack: `Inter, "Helvetica Neue", Helvetica, Arial, sans-serif` as the practical default (geometric,
  neutral, close to Swiss-era grotesques, and free via Google Fonts). If more character is wanted,
  `"Space Grotesk"` or `"Archivo"` are free alternatives with a more distinctive Swiss/grotesk feel — pick
  one, don't mix multiple display faces.
- Headings: bold weight (600–700), tight letter-spacing, no decorative treatment
- Body: regular weight (400–450), comfortable line-height (1.4–1.6)
- No italics for emphasis — use weight or an accent color instead
- Numbers/data (slot times, prices, counts) may use tabular-nums for alignment in tables

## Layout

- Consistent page margin/gutter, content aligned to a grid — avoid centered-narrow-column "marketing
  page" layouts for app screens; app screens should feel structured and left-aligned like a data tool
- Section separation via hairline (`1px solid var(--border)`) rather than card elevation/shadow
- Buttons: rectangular or minimally rounded (2–4px), solid fill for primary actions using the palette
  above, outline style for secondary actions
- Tables: hairline row dividers, no zebra-striping unless density requires it, left-align text columns,
  right-align numeric columns
