# Coach photographs

One folder per coach. The folder numbers line up with the order of the
`COACHES` array in `assets/site.js`, so `coach-1` is the first card the
mentor stack shows.

```
coach-1/   Founder & Head Coach
coach-2/   Coach · Tournament Preparation
coach-3/   Coach · Youth Program
```

## The order on the card is the order in the folder

Each card plays **every** photograph in that coach's folder, in the order the
folder lists them — alphabetically by filename. The first file is the one the
card opens on, and it cycles down the list from there, one photo every two
seconds.

Today that works out as:

| Folder    | Order                                                        |
|-----------|--------------------------------------------------------------|
| `coach-1` | certificate → portrait → stage → teaching                    |
| `coach-2` | award → cheque → classroom → portrait → room                 |
| `coach-3` | portrait → trophy → cheque → varsity → karachi               |

`coach-3` carries `1-`…`5-` prefixes to hold that exact sequence; the other
two are still plain alphabetical. Mixing the two styles is fine — the rule is
only ever "sort the filenames".

**To change the order, rename the files.** Alphabetical is the whole rule, so
a numeric prefix gives you exact control:

```
coach-1/1-portrait.jpg
coach-1/2-certificate.jpg
coach-1/3-stage.jpg
```

That is also how you put the portrait first, if you would rather a coach's
card opened on their face than on a certificate.

## Adding a photo

1. Drop the file into that coach's folder.
2. Add a line to that coach's list in the `PHOTOS` block at the top of
   `assets/site.js`, in the same position the folder lists it.
3. Give it a caption — the caption doubles as the image's alt text.

The `PHOTOS` block is generated from the folder contents, so if the two ever
disagree the folder is right and the block needs updating.

## How long a coach holds the front

The stack advances to the next coach on its own, and each coach holds the
front for exactly one full pass of its own photographs — four photos means
eight seconds, five means ten. Add a photo and that coach simply gets longer.
The countdown is drawn on the active marker underneath the card.

Resting the pointer on the card holds it. Clicking a marker, a background
card or a photograph stops the rotation for good, on the assumption that you
picked that coach on purpose.

## Adding a coach

Create `coach-4/`, add a `coach4` list to `PHOTOS`, and append a fourth object
to `COACHES`. The stack, the counter, the markers and the dwell all size
themselves off that array, so nothing else needs touching.

## Sizes

Photographs are displayed at 540 × 675 (4:5). The honours photograph on
`coaches.html` is displayed at 540 × 405 (4:3) and is referenced directly in
the markup rather than through `PHOTOS` — it points at
`coach-3/trophy.jpg`, so that file needs to stay put unless you repoint it.
