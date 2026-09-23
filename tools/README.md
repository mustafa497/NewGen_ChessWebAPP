# Nexus Tactics Rush — setup and puzzle import

Everything here is plain static files. There is no build step and nothing to
install for the site itself; Node is only needed for the scripts in this
folder, which run offline on your machine and write JSON into
`assets/puzzles/`.

```
rush.html                     the app
assets/chess-core.js          chess rules (no dependencies)
assets/puzzles-embedded.js    starter puzzles, so file:// works
assets/rush.js                game logic
assets/rush.css               styling
assets/puzzles/index.json     which batches exist
assets/puzzles/nexus-*.json   the starter collection
tools/perft.mjs               proves the rules engine correct
tools/generate-puzzles.mjs    builds the starter collection
tools/import-lichess.mjs      imports the real Lichess database
```

## Running it

**Double-clicking `rush.html` works.** The starter puzzles are embedded in
`assets/puzzles-embedded.js`, which loads as an ordinary script, so no network
request is needed to play. Keep that file next to the page.

Serving it over http works too, and is what you want for anything beyond the
starter set — imported Lichess batches are fetched, and are far too large to
embed:

```bash
# from the project root
python -m http.server 4173
# then visit http://127.0.0.1:4173/rush.html
```

On Namecheap or any normal host, upload as usual and it just works.

| How you open it | Starter puzzles | Imported Lichess puzzles |
|---|---|---|
| Double-click the file | yes, embedded | no — fetch is blocked on `file://` |
| Over http | yes | yes, fetched in batches |

## Checking the chess rules

```bash
node tools/perft.mjs          # depth 3, a few seconds
node tools/perft.mjs --deep   # full depth, ~6s, 16.5 million positions
```

Perft counts every leaf position at a given depth and compares against the
published totals for six standard test positions. Those positions are chosen
because between them they cover castling, en passant, promotion, pins,
discovered check and double check. If a single rule were wrong the totals
would not match. Run this after touching `assets/chess-core.js`.

## The starter puzzles

`assets/puzzles/nexus-*.json` ships with the site. These are **Nexus-composed
positions, not Lichess puzzles** — nothing in them is attributed to a real
game or player, because that could not be verified.

They are produced by searching random seeded positions for a forced mate, and
every stored solution is replayed from scratch and re-checked before it is
written. To rebuild or resize the set:

```bash
node tools/generate-puzzles.mjs 140     # target count
```

This writes both the batch files **and** `assets/puzzles-embedded.js`, so the
two never drift apart.

The set deliberately contains all three record shapes, so every code path in
the app is exercised by real data:

| Shape | What it is |
|---|---|
| `setupPly: 0`, `solverColor: "w"` | White to move, solve immediately |
| `setupPly: 0`, `solverColor: "b"` | Black to move — the board flips |
| `setupPly: 1` | Lichess-shaped: the app plays `moves[0]` for you, your solution starts at `moves[1]` |

## Importing the real Lichess database

The Lichess open puzzle database is CC0 (public domain) and contains about
five million puzzles with ratings, themes and links to the source games.

**1 — download** (~250 MB compressed):
<https://database.lichess.org/lichess_db_puzzle.csv.zst>

**2 — decompress** to `lichess_db_puzzle.csv` (`zstd -d`, or 7-Zip on Windows).

**3 — import:**

```bash
node tools/import-lichess.mjs path/to/lichess_db_puzzle.csv
```

Useful options:

```bash
--max 3000              how many to keep            (default 1500)
--min-rating 600        lowest rating               (default 500)
--max-rating 1800       highest rating              (default 2200)
--min-plays 200         require this many plays     (default 100)
--themes fork,pin,mateIn2   keep only these themes  (default: all)
--batch 25              puzzles per file            (default 25)
```

The importer **validates every record** by replaying its whole solution
through `chess-core.js`, and drops anything malformed with a count of why.
It writes `lichess-*.json` batches and adds a `lichess` source to
`index.json` **alongside** the Nexus set rather than replacing it. The app
picks them up on the next page load; no code changes needed.

### The part that trips people up

The FEN in the CSV is the position **before** the opponent moves into the
tactic. The first move in `Moves` is that opponent move — it must be played
automatically, and the player's own solution begins at the **second** move.
The importer stores `setupPly: 1` for exactly this reason, and the app honours
it. Get this wrong and every puzzle looks like it has the wrong answer.

### Keeping it out of the page

The *starter* set is embedded (26 KB) so the page works offline and from the
file system. Everything imported stays out of the bundle: the app reads
`index.json`, fetches only the batches it needs, and prefetches further ones as
the player's score climbs. Importing 3,000 Lichess puzzles adds 120 small files
that are fetched on demand, not shipped in the page.

## Removing the Lichess puzzles again

```bash
rm assets/puzzles/lichess-*.json
```

…then delete the `lichess` entry from the `sources` array in
`assets/puzzles/index.json`. The Nexus set keeps working on its own.
