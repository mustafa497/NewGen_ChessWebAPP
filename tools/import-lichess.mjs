/* Imports the Lichess open puzzle database (CC0) into the batch format
   Nexus Tactics Rush loads.

   The database is far too large to ship in the page, so this script filters
   it down, validates every record against assets/chess-core.js, and writes
   small JSON batches that the app fetches on demand.

   ---------------------------------------------------------------------
   HOW TO USE
   ---------------------------------------------------------------------
   1. Download the database (about 250 MB compressed, ~5 million puzzles):
        https://database.lichess.org/lichess_db_puzzle.csv.zst

   2. Decompress it to lichess_db_puzzle.csv (zstd -d, or 7-Zip on Windows).

   3. Run, from the project root:
        node tools/import-lichess.mjs path/to/lichess_db_puzzle.csv

      Options:
        --max 2000          how many puzzles to keep          (default 1500)
        --min-rating 500    lowest rating to accept           (default 500)
        --max-rating 2200   highest rating to accept          (default 2200)
        --min-plays 200     require this many recorded plays  (default 100)
        --themes mateIn1,fork,pin   keep only these themes    (default: all)
        --batch 25          puzzles per JSON file             (default 25)

   4. The app picks the new puzzles up automatically — index.json is
      rewritten and the Lichess source is added alongside the Nexus one.

   ---------------------------------------------------------------------
   THE FORMAT, AND THE ONE THING PEOPLE GET WRONG
   ---------------------------------------------------------------------
   CSV columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,
                NbPlays,Themes,GameUrl,OpeningTags

   The FEN is the position BEFORE the opponent plays into the tactic. The
   first move in Moves is that opponent move: it must be played automatically
   before the player sees the board, and the player's own solution starts at
   the second move. That is why every record here is stored with setupPly: 1.

   Licence: the Lichess puzzle database is released under CC0 (public
   domain). Attribution is not required but is decent practice — the app
   shows a source link for every imported puzzle.
*/
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const srcJs = fs.readFileSync(new URL('../assets/chess-core.js', import.meta.url), 'utf8');
new Function(srcJs).call(globalThis);
const C = globalThis.NexusChess;

/* ---- arguments ---- */
const argv = process.argv.slice(2);
const csvPath = argv.find(a => !a.startsWith('--'));
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (!csvPath) {
  console.error('Usage: node tools/import-lichess.mjs <lichess_db_puzzle.csv> [--max 1500] [--min-rating 500] [--max-rating 2200]');
  console.error('Download: https://database.lichess.org/lichess_db_puzzle.csv.zst');
  process.exit(1);
}
if (!fs.existsSync(csvPath)) {
  console.error('Not found: ' + csvPath);
  console.error('Download the database from https://database.lichess.org/#puzzles and decompress it first.');
  process.exit(1);
}

const MAX        = Number(opt('max', 1500));
const MIN_RATING = Number(opt('min-rating', 500));
const MAX_RATING = Number(opt('max-rating', 2200));
const MIN_PLAYS  = Number(opt('min-plays', 100));
const BATCH      = Number(opt('batch', 25));
const THEMES     = opt('themes', '') ? opt('themes', '').split(',').map(s => s.trim()) : null;

/* ---- validation ----
   A record is only kept if the whole solution replays legally from the FEN.
   Anything malformed is counted and dropped rather than shipped. */
function validate(fen, moves) {
  let st;
  try { st = C.fromFEN(fen); } catch { return 'bad FEN'; }
  if (st.kings.w < 0 || st.kings.b < 0) return 'missing king';
  if (moves.length < 2) return 'too few moves';

  for (let i = 0; i < moves.length; i++) {
    const m = C.fromUCI(st, moves[i]);
    if (!m) return 'illegal move ' + (i + 1) + ' (' + moves[i] + ')';
    C.make(st, m);
  }
  return null;
}

/* the player's side is whoever is to move AFTER the setup move */
function solverColor(fen) {
  const st = C.fromFEN(fen);
  return st.turn === 'w' ? 'b' : 'w';
}

/* ---- read ---- */
const kept = [];
const rejected = { rating: 0, plays: 0, themes: 0, malformed: 0 };
const reasons = new Map();
let seen = 0;

const rl = readline.createInterface({
  input: fs.createReadStream(csvPath, { encoding: 'utf8' }),
  crlfDelay: Infinity
});

console.log('Reading ' + path.basename(csvPath) + '…');

for await (const line of rl) {
  if (!line || line.startsWith('PuzzleId')) continue;
  seen++;

  const col = line.split(',');
  if (col.length < 9) { rejected.malformed++; continue; }

  const [id, fen, movesRaw, ratingRaw, , , playsRaw, themesRaw, gameUrl] = col;
  const rating = Number(ratingRaw);
  const plays = Number(playsRaw);

  if (!Number.isFinite(rating) || rating < MIN_RATING || rating > MAX_RATING) { rejected.rating++; continue; }
  if (Number.isFinite(plays) && plays < MIN_PLAYS) { rejected.plays++; continue; }

  const themes = (themesRaw || '').split(' ').filter(Boolean);
  if (THEMES && !themes.some(t => THEMES.includes(t))) { rejected.themes++; continue; }

  const moves = (movesRaw || '').split(' ').filter(Boolean);
  const problem = validate(fen, moves);
  if (problem) {
    rejected.malformed++;
    reasons.set(problem.replace(/\(.*\)/, '(…)'), (reasons.get(problem.replace(/\(.*\)/, '(…)')) || 0) + 1);
    continue;
  }

  kept.push({
    id,
    fen,
    moves,
    rating,
    themes,
    gameUrl: gameUrl || null,
    source: 'lichess',
    setupPly: 1,                                   // first move is the opponent's
    altMate: themes.includes('mateIn1'),           // any mating move counts
    solverColor: solverColor(fen)
  });

  if (kept.length >= MAX) break;
}
rl.close();

if (!kept.length) {
  console.error('\nNothing passed the filters. Try widening --min-rating / --max-rating, or lowering --min-plays.');
  process.exit(1);
}

/* ---- write ---- */
kept.sort((a, b) => a.rating - b.rating);

const OUT = new URL('../assets/puzzles/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (/^lichess-\d+\.json$/.test(f)) fs.unlinkSync(new URL(f, OUT));
}

const batches = [];
for (let i = 0; i < kept.length; i += BATCH) {
  const part = kept.slice(i, i + BATCH);
  const file = 'lichess-' + String(batches.length + 1).padStart(3, '0') + '.json';
  fs.writeFileSync(new URL(file, OUT), JSON.stringify(part));
  batches.push({
    file,
    count: part.length,
    minRating: part[0].rating,
    maxRating: part[part.length - 1].rating
  });
}

/* keep whatever the generator wrote and add this source beside it */
const indexUrl = new URL('index.json', OUT);
let index = { generated: '', sources: [] };
if (fs.existsSync(indexUrl)) {
  try { index = JSON.parse(fs.readFileSync(indexUrl, 'utf8')); } catch {}
}
index.generated = new Date().toISOString().slice(0, 10);
index.sources = (index.sources || []).filter(s => s.name !== 'lichess');
index.sources.push({
  name: 'lichess',
  note: 'Lichess open puzzle database (CC0). Imported by tools/import-lichess.mjs and validated against assets/chess-core.js.',
  licence: 'CC0',
  total: kept.length,
  batches
});
fs.writeFileSync(indexUrl, JSON.stringify(index, null, 2));

const bands = {};
for (const p of kept) {
  const k = Math.floor(p.rating / 200) * 200;
  bands[k + '-' + (k + 199)] = (bands[k + '-' + (k + 199)] || 0) + 1;
}

console.log('\nread      ' + seen.toLocaleString() + ' rows');
console.log('kept      ' + kept.length.toLocaleString() + ' puzzles  (' + kept[0].rating + '–' + kept[kept.length - 1].rating + ')');
console.log('rejected  rating ' + rejected.rating.toLocaleString() +
            ' · plays ' + rejected.plays.toLocaleString() +
            ' · themes ' + rejected.themes.toLocaleString() +
            ' · malformed ' + rejected.malformed.toLocaleString());
if (reasons.size) {
  console.log('\nvalidation failures:');
  for (const [why, n] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log('  ' + String(n).padStart(6) + '  ' + why);
  }
}
console.log('\nby rating :', JSON.stringify(bands));
console.log('batches   :', batches.length, 'files in assets/puzzles/');
console.log('\nDone. Reload the Tactics Rush page — the new puzzles are picked up automatically.');
