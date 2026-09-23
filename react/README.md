# Meet the Mentors — Nexus Chess Academy

A 3D rotating mentor showcase. Three coaches, one featured at a time, each with a
layered stack of four photographs that cycles on its own.

```
react/
├── components/
│   ├── MeetTheMentors.tsx   the component (no edits needed for content)
│   └── mentors.ts           ← ALL content lives here
├── demo/page.tsx            example Next.js page
└── public/coaches/          the 12 selected photographs
```

## Install

This needs a **Next.js + TypeScript + Tailwind** project. It is not a drop-in for
the current `academy.html` — see *Using this with the existing site* below.

```bash
npm install framer-motion
```

Then copy the folders across:

```bash
cp -r react/components/*  your-app/components/
cp -r react/public/coaches your-app/public/
cp    react/demo/page.tsx  your-app/app/mentors/page.tsx
```

Visit `/mentors`.

Tailwind needs no config beyond the defaults — every colour is applied inline or
via arbitrary values, so nothing depends on a custom theme.

## Editing content

**Only ever edit `components/mentors.ts`.** Everything is data-driven: name,
role, rating, experience, bio, specialties, three achievements, four photographs
with alt text, the CTA, and the accent colour.

Fields still marked `⟵ REPLACE` are placeholders carried over from your existing
site — names, ratings, years and biographies. The photographs, captions and
achievements are real and already correct.

### Swapping a photograph

Change the `src` in `mentors.ts` and put the file in `public/coaches/`. Keep the
order meaningful:

| Slot | Should be |
|---|---|
| `photos[0]` | strong primary portrait |
| `photos[1]` | coach teaching students |
| `photos[2]` | coach playing or analysing chess |
| `photos[3]` | tournament, award or achievement |

If a face sits high or low in the frame, set `focal` (an `object-position`) so
the crop never cuts it badly — e.g. `focal: '50% 25%'` pulls the crop upward.

## How it behaves

**Rotating between coaches** — move the pointer upward over the section, or
scroll up, to advance; downward goes back. Click any card behind the active one
to bring it forward. Arrow keys work in all four directions once the section has
focus, plus Home/End. One gesture produces exactly one transition: there is a
950 ms cooldown, and the pointer needs ~78 px of *sustained* travel, so small
accidental movements do nothing.

The wheel only takes over while the section fills most of the viewport, so the
page still scrolls normally past it.

**The photo stack** — the front photograph changes every 3.1 s while its card is
active. Hovering pauses it. Clicking any photograph brings it forward. The
sequence resets whenever a different coach takes the stage. The stack has a
slight parallax that follows the pointer.

**Mobile** — swipe up for the next coach, down for the previous. Tap the markers
to jump directly. The layout stacks vertically with the photographs beneath the
information, and touch targets stay large.

## Accessibility

- Full keyboard support with a visible focus ring on the section, the markers,
  each photograph and the CTA
- Every photograph has descriptive alt text; decorative duplicates behind the
  front image are given empty alt so they are not announced twice
- The active mentor is announced via an `aria-live` region
- Background cards are `aria-hidden` and their photographs are removed from the
  tab order, so only the featured coach is reachable
- **`prefers-reduced-motion` is respected** — the 3D rotation is replaced by a
  gentle crossfade, the photo auto-advance stops entirely, and parallax and the
  magnetic CTA are disabled

## Performance

- All motion runs on `transform` and `opacity` only, so it stays on the GPU
- Every `<img>` carries explicit `width`/`height`, and the stage has a reserved
  min-height, so nothing shifts as images load
- Only the front photograph of the active card loads eagerly; the rest are lazy
- Timers and listeners are cleaned up on unmount and whenever the active coach
  changes

## Tuning

Constants at the top of `MeetTheMentors.tsx`:

| Constant | Default | What it does |
|---|---|---|
| `COOLDOWN_MS` | `950` | Minimum gap between rotations |
| `POINTER_THRESHOLD` | `78` | Pointer travel needed to rotate |
| `WHEEL_THRESHOLD` | `28` | Wheel delta needed to rotate |
| `SWIPE_THRESHOLD` | `56` | Swipe distance on touch |
| `PHOTO_INTERVAL_MS` | `3100` | Front photo dwell time |
| `CARD_SPRING` | `0.9s / 0.14 bounce` | Rotation feel |
| `STACK` | — | Depth, scale and opacity of the three cards |

## Using this with the existing site

`academy.html` is a single vanilla HTML file — it has no React, so this component
cannot be dropped into it as-is. Two options:

1. **Move the site to Next.js.** Best long-term; the dashboard would benefit too.
2. **Port this to vanilla JS.** The same layout and motion can be rebuilt with
   CSS transforms and a small script, matching the existing `#coachSpotlight`
   section already in `academy.html`. No React, no build step.

Option 2 is the smaller change if you only want this one section.
