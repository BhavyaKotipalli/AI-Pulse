# AI Pulse — Design System

**Feel:** a calm instrument panel. Linear's restraint, Bloomberg's density where it earns it, Perplexity's readable answers. Dark-first; color carries meaning, not decoration.

## Tokens (`src/app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08090c` | app background |
| `--surface-1` | `#0e1015` | cards |
| `--surface-2` | `#14171e` | raised / hover |
| `--surface-3` | `#1b1f28` | inputs, chips |
| `--line` | `rgb(255 255 255 / 0.07)` | hairlines |
| `--line-strong` | `rgb(255 255 255 / 0.12)` | focused borders |
| `--fg` | `#eceef3` | primary text |
| `--fg-muted` | `#9aa1b1` | secondary |
| `--fg-subtle` | `#646b7b` | meta, captions |
| `--accent` | `#8b93ff` (iris) | primary actions, focus, links |
| `--signal-up` | `#3ecf8e` | growing / positive |
| `--signal-hot` | `#ff8a4c` | exploding / breaking |
| `--signal-warn` | `#f5c451` | caution / speculation |
| `--signal-down` | `#f06272` | declining |
| `--label-fact` | `#5cc8ff` | FACT |
| `--label-analysis` | `#b493ff` | ANALYSIS |
| `--label-speculation` | `#f5c451` | SPECULATION |

Gradients: a single soft radial "aurora" behind the hero and the Today header (≤ 12 % opacity). Glass (`backdrop-blur` + 70 % surface) only on the top bar and the command palette.

## Typography

- **Geist Sans** for UI, **Geist Mono** for numbers, scores, timestamps, keyboard hints.
- Scale: 12 / 13 / 14 (body) / 16 / 20 / 28 / 44 (hero, tracking −0.03em).
- `font-variant-numeric: tabular-nums` on all metrics.

## Layout

- App shell: 248 px sidebar (collapsible to icons ≤ 1024 px, sheet on mobile) + sticky 56 px top bar (search trigger, ⌘K hint, voice, user).
- Content max width 1240 px; 12-column grid, 24 px gutters; sections separated by 48 px.

## Components

| Component | Notes |
|---|---|
| `Card` | 1 px `--line` border, 12 px radius, hover lifts border to `--line-strong` — no shadows on dark. |
| `ScoreBadge` | Mono number in a ring; color by band: ≥ 85 hot, ≥ 70 accent, ≥ 50 fg, else subtle. Tooltip shows breakdown. |
| `ClaimLabel` | FACT / ANALYSIS / SPECULATION pill with tokenized colors. |
| `MomentumBadge` | 🔥 Exploding · 📈 Growing · ➡ Stable · 📉 Declining, via icon + color, not emoji alone (a11y). |
| `Sparkline` | 1.5 px stroke SVG, area fill at 10 %. |
| `SourceLine` | favicon-less source name · relative time · DEMO tag when seeded. |
| `SectionHeader` | eyebrow (mono, uppercase 11 px), title, optional "View all →". |
| `Skeleton` | shimmer at 4 % white, matches final layout to avoid shift. |
| `CommandPalette` | cmdk; groups: Navigate, Ask, Search results; `⌘K` / `Ctrl K`, `/` focuses search. |

## Motion

- Durations: 120 ms (hover), 200 ms (enter), 320 ms (page sections). Easing `cubic-bezier(.2,.8,.2,1)`.
- Lists stagger 30 ms per item, max 8 items.
- Respect `prefers-reduced-motion`: all motion components fall back to opacity only.

## Accessibility

- Contrast ≥ 4.5:1 for body text (`--fg-muted` on `--surface-1` = 7.1:1).
- Visible focus ring: 2 px `--accent` at 60 % + 2 px offset.
- All icon-only buttons have `aria-label`; momentum/score never rely on color alone.
- Keyboard: `⌘K` palette, `g` then `t` → Today, `g` `r` → Research, `?` → shortcuts.

## Shortcuts

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl K` | Command palette |
| `/` | Focus search (opens palette) |
| `g o / t / f / r / e / s / c / l / a` | Overview · Today · For You · Research · Experiments · Startups · Career · Library · Ask AI |
