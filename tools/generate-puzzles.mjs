/* Builds the starter puzzle collection for Nexus Tactics Rush.

   These are Nexus-composed positions, NOT Lichess puzzles. Every one is
   found by searching for a forced mate with assets/chess-core.js and is
   then replayed from scratch and re-checked before being written, so the
   stored solution is provably correct.

   Records use the Lichess puzzle shape so a single code path in the app
   serves both sources. Run tools/import-lichess.mjs to add the real
   database alongside these.

   Run: node tools/generate-puzzles.mjs [count]
*/
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../assets/chess-core.js', import.meta.url), 'utf8');
new Function(src).call(globalThis);
const C = globalThis.NexusChess;

/* ---- deterministic RNG, so regenerating gives the same set ---- */
let seed = 20260915;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = a => a[Math.floor(rnd() * a.length)];
const randInt = n => Math.floor(rnd() * n);

/* ---- forced-mate search: every first move that mates in <= n of our moves ---- */
function matingMoves(st, n) {
  const out = [];
  for (const m of C.legalMoves(st)) {
    C.make(st, m);
    let good;
    if (C.isCheckmate(st)) good = true;
    else if (n <= 1) good = false;
    else {
      const replies = C.legalMoves(st);
      good = replies.length > 0 && replies.every(r => {
        C.make(st, r);
        const found = matingMoves(st, n - 1).length > 0;
        C.unmake(st);
        return found;
      });
    }
    C.unmake(st);
    if (good) out.push(m);
  }
  return out;
}

/* Does a forced mate in <= n exist? Stops at the first one found, so it is
   far cheaper than matingMoves and is used to reject positions that already
   mate faster than the depth we are hunting for. */
function hasMate(st, n) {
  for (const m of C.legalMoves(st)) {
    C.make(st, m);
    let good;
    if (C.isCheckmate(st)) good = true;
    else if (n <= 1) good = false;
    else {
      const replies = C.legalMoves(st);
      good = replies.length > 0 && replies.every(r => {
        C.make(st, r);
        const f = hasMate(st, n - 1);
        C.unmake(st);
        return f;
      });
    }
    C.unmake(st);
    if (good) return true;
  }
  return false;
}

/* Principal variation of a forced mate, as UCI.
   The defence matters: taking Black's first legal move can pick a reply that
   walks into a quicker mate, which made the stored line shorter than the
   puzzle claimed. Choose the reply that holds out longest instead. */
function mateLine(st, first, n) {
  const line = [C.toUCI(first)];
  C.make(st, first);
  if (!C.isCheckmate(st)) {
    const replies = C.legalMoves(st);
    let best = replies[0], bestDist = -1;
    for (const r of replies) {
      C.make(st, r);
      let dist = 1;
      while (dist < n && !hasMate(st, dist)) dist++;   // how long this defence survives
      C.unmake(st);
      if (dist > bestDist) { bestDist = dist; best = r; }
    }
    line.push(C.toUCI(best));
    C.make(st, best);
    const next = matingMoves(st, n - 1)[0];
    line.push(...mateLine(st, next, n - 1));
    C.unmake(st);
  }
  C.unmake(st);
  return line;
}

/* ---- seeding ----
   Random placement essentially never mates, so the defending king is pushed
   to an edge and the attackers are dropped within a few squares of it. */
const SETS = [
  { attackers: ['Q'],         defenders: [],        depth: 1, band: 'easy' },
  { attackers: ['R', 'R'],    defenders: [],        depth: 1, band: 'easy' },
  { attackers: ['Q', 'R'],    defenders: [],        depth: 1, band: 'easy' },
  { attackers: ['R', 'B'],    defenders: ['p'],     depth: 1, band: 'medium' },
  { attackers: ['R', 'N'],    defenders: ['p'],     depth: 1, band: 'medium' },
  { attackers: ['Q', 'N'],    defenders: ['p','p'], depth: 1, band: 'medium' },
  { attackers: ['B', 'B'],    defenders: [],        depth: 1, band: 'medium' },
  { attackers: ['Q', 'B'],    defenders: ['r'],     depth: 2, band: 'hard' },
  { attackers: ['R', 'R'],    defenders: ['p','p'], depth: 2, band: 'hard' },
  { attackers: ['Q', 'N'],    defenders: ['r','p'], depth: 2, band: 'hard' },
  { attackers: ['R','B','N'], defenders: ['p','p'], depth: 2, band: 'expert' },
  { attackers: ['Q', 'R'],    defenders: ['q','p'], depth: 2, band: 'expert' },
  /* a pawn on the seventh, so the answer is a promotion */
  { attackers: ['P7', 'R'],   defenders: [],        depth: 1, band: 'medium' },
  { attackers: ['P7', 'B'],   defenders: ['p'],     depth: 1, band: 'hard' },
  { attackers: ['P7', 'Q'],   defenders: [],        depth: 1, band: 'medium' },
  /* mate in three: heavier material, and the king is allowed off the edge
     so there is something to drive it toward */
  { attackers: ['Q', 'R'],     defenders: [],        depth: 3, band: 'expert', open: true },
  { attackers: ['R', 'R'],     defenders: [],        depth: 3, band: 'expert', open: true },
  { attackers: ['Q', 'B'],     defenders: [],        depth: 3, band: 'expert', open: true },
  { attackers: ['Q', 'N'],     defenders: ['p'],     depth: 3, band: 'expert', open: true }
];

const EDGE = [];
for (let i = 0; i < 64; i++) {
  const f = i & 7, r = i >> 3;
  if (f === 0 || f === 7 || r === 0 || r === 7) EDGE.push(i);
}

const dist = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
const isBackRankPawn = (p, i) => p.toLowerCase() === 'p' && ((i >> 3) === 0 || (i >> 3) === 7);

function buildPosition(set) {
  const board = new Array(64).fill(null);
  const used = new Set();

  const bk = set.open ? randInt(64) : pick(EDGE);
  board[bk] = 'k';
  used.add(bk);

  let wk = -1;
  for (let guard = 0; guard < 200; guard++) {
    const c = randInt(64);
    if (!used.has(c) && dist(c, bk) > 1) { wk = c; break; }
  }
  if (wk < 0) return null;
  board[wk] = 'K';
  used.add(wk);

  const near = [];
  for (let i = 0; i < 64; i++) if (!used.has(i) && dist(i, bk) <= 3) near.push(i);
  if (near.length < set.attackers.length + set.defenders.length) return null;

  for (const p of set.attackers) {
    let free;
    if (p === 'P7') {
      /* row 1 is rank 7: one square from promotion */
      free = [];
      for (let f = 0; f < 8; f++) { const i = 8 + f; if (!used.has(i)) free.push(i); }
    } else {
      free = near.filter(i => !used.has(i));
    }
    if (!free.length) return null;
    const s = pick(free);
    board[s] = p === 'P7' ? 'P' : p;
    used.add(s);
  }
  for (const p of set.defenders) {
    const free = near.filter(i => !used.has(i) && !isBackRankPawn(p, i));
    if (!free.length) return null;
    const s = pick(free);
    board[s] = p;
    used.add(s);
  }
  return board;
}

function boardToFEN(board) {
  let out = '';
  for (let r = 0; r < 8; r++) {
    let run = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[(r << 3) + f];
      if (!p) run++;
      else { if (run) { out += run; run = 0; } out += p; }
    }
    if (run) out += run;
    if (r < 7) out += '/';
  }
  return out + ' w - - 0 1';
}

/* ---- themes, read off the real position rather than guessed ---- */
function themesFor(st, line, depth) {
  const t = ['mateIn' + depth, 'mate'];
  const first = C.fromUCI(st, line[0]);
  const piece = st.b[first.from].toLowerCase();
  const byPiece = { q: 'queenAttack', r: 'rookAttack', b: 'bishopAttack', n: 'knightAttack', p: 'pawnAttack', k: 'kingAttack' };
  t.push(byPiece[piece] || 'attack');
  if (first.promo) t.push('promotion', 'advancedPawn');

  C.make(st, first);
  const backRank = (st.kings.b >> 3) === 0;
  const mated = C.isCheckmate(st);
  C.unmake(st);
  if (mated && backRank) t.push('backRankMate');
  if (line.length > 1) t.push('short');
  return [...new Set(t)];
}

const RATING_BAND = { easy: [600, 980], medium: [1000, 1380], hard: [1400, 1780], expert: [1800, 2200] };

function ratingFor(band, st, winners, depth) {
  const [lo, hi] = RATING_BAND[band];
  const moves = C.legalMoves(st).length;
  const spread = Math.min(1, (moves / 40) * 0.6 + (winners === 1 ? 0.4 : 0.1));
  let r = lo + Math.round((hi - lo) * spread);
  if (depth >= 2) r += 60;
  return Math.max(500, Math.min(2400, r));
}

/* reflect the board top-to-bottom and swap colours: a White mate becomes the
   same puzzle for Black, which is how the set gets black-side orientation */
function mirrorFEN(fen) {
  const [placement, turn] = fen.split(' ');
  const rows = placement.split('/').reverse();
  const swapped = rows.map(r => r.split('').map(ch => {
    if (ch >= '1' && ch <= '8') return ch;
    return ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
  }).join(''));
  return swapped.join('/') + ' ' + (turn === 'w' ? 'b' : 'w') + ' - - 0 1';
}
function mirrorUCI(u) {
  const flip = s => s[0] + (9 - Number(s[1]));
  return flip(u.slice(0, 2)) + flip(u.slice(2, 4)) + (u.length > 4 ? u[4] : '');
}

/* how many of OUR moves the stored line actually takes */
const lineDepth = (line, setupPly = 0) => Math.ceil((line.length - setupPly) / 2);

function replayMates(fen, line) {
  const st = C.fromFEN(fen);
  for (const u of line) {
    const m = C.fromUCI(st, u);
    if (!m) return false;
    C.make(st, m);
  }
  return C.isCheckmate(st);
}

/* ---- generate ---- */
const WANT = Number(process.argv[2] || 80);
/* Depth-3 searches are expensive and the hit rate is low, so the run is
   bounded by the clock as well as by attempts. Pass seconds as the second
   argument; it stops early and keeps whatever it found. */
const BUDGET_MS = Number(process.argv[3] || 180) * 1000;
const puzzles = [];
const seen = new Set();
let tries = 0;
const started = Date.now();
let depth3Tries = 0;

while (puzzles.length < WANT && tries < 600000 && Date.now() - started < BUDGET_MS) {
  tries++;
  const set = pick(SETS);
  const board = buildPosition(set);
  if (!board) continue;

  const fen = boardToFEN(board);
  if (seen.has(fen)) continue;

  let st;
  try { st = C.fromFEN(fen); } catch { continue; }

  if (C.inCheck(st, 'b')) continue;              // side not to move already in check
  const legal = C.legalMoves(st);
  if (legal.length === 0) continue;              // already over

  /* a "mate in three" that is really a mate in two is a bad puzzle, and
     checking cheaply here keeps the expensive search off most positions */
  if (set.depth > 1 && hasMate(st, set.depth - 1)) continue;
  if (set.depth >= 3) depth3Tries++;

  const winners = matingMoves(st, set.depth);
  if (!winners.length) continue;
  if (set.depth > 1 && winners.length > 1) continue;                 // must be a single idea
  if (set.depth === 1 && winners.length > 3) continue;
  if (set.depth === 1 && winners.length / legal.length > 0.34) continue;

  const line = mateLine(st, winners[0], set.depth);
  if (!replayMates(fen, line)) continue;         // independent re-check

  seen.add(fen);
  const rating = ratingFor(set.band, st, winners.length, set.depth);
  const themes = themesFor(st, line, set.depth);

  /* Three shapes, so the app's every code path is exercised by real data:
       0  White solves immediately
       1  the same puzzle mirrored, so Black solves and the board flips
       2  Lichess-shaped: the FEN sits before an opponent move which the app
          plays automatically, and the solution starts one ply later        */
  const shape = puzzles.length % 3;

  if (shape === 1) {
    const mFen = mirrorFEN(fen);
    const mLine = line.map(mirrorUCI);
    if (replayMates(mFen, mLine)) {
      puzzles.push({
        id: 'nx0000', fen: mFen, moves: mLine, rating, mateIn: lineDepth(mLine),
        themes: themes.concat('blackToSolve'),
        gameUrl: null, source: 'nexus', setupPly: 0,
        altMate: set.depth === 1, solverColor: 'b'
      });
      continue;
    }
  }

  if (shape === 2) {
    /* find a legal Black move that walks into this exact position, by
       searching backwards one ply: place the position, ask which Black
       moves from a predecessor reach it. Simpler and sound: start from a
       Black-to-move copy and test each reply. */
    const pre = findSetup(fen, line, set.depth);
    if (pre) {
      puzzles.push({
        id: 'nx0000', fen: pre.fen, moves: [pre.setup].concat(line), rating, mateIn: lineDepth([pre.setup].concat(line), 1),
        themes: themes.concat('fromSetup'),
        gameUrl: null, source: 'nexus', setupPly: 1,
        altMate: set.depth === 1, solverColor: 'w'
      });
      continue;
    }
  }

  puzzles.push({
    id: 'nx0000', fen, moves: line, rating, mateIn: lineDepth(line), themes,
    gameUrl: null, source: 'nexus',
    setupPly: 0,                                  // player moves immediately
    altMate: set.depth === 1,                     // any mating move scores
    solverColor: 'w'
  });
}

/* Build a Lichess-shaped record: a position with Black to move, where one
   Black move leads into the mate we already verified. We do it by giving a
   Black piece a legal square to have come from. */
function findSetup(fen, line, depth) {
  const st = C.fromFEN(fen);
  /* try retracting each Black piece by one legal move */
  for (let i = 0; i < 64; i++) {
    const piece = st.b[i];
    if (!piece || piece === piece.toUpperCase()) continue;   // Black only
    if (piece === 'k') continue;                             // keep kings put
    for (let j = 0; j < 64; j++) {
      if (st.b[j]) continue;
      const back = st.b.slice();
      back[j] = piece;
      back[i] = null;
      let fenBack = '';
      for (let r = 0; r < 8; r++) {
        let run = 0;
        for (let f = 0; f < 8; f++) {
          const q = back[r * 8 + f];
          if (!q) run++; else { if (run) { fenBack += run; run = 0; } fenBack += q; }
        }
        if (run) fenBack += run;
        if (r < 7) fenBack += '/';
      }
      fenBack += ' b - - 0 1';

      let pre;
      try { pre = C.fromFEN(fenBack); } catch { continue; }
      if (C.inCheck(pre, 'w')) continue;          // White cannot already be in check
      if (C.inCheck(pre, 'b')) continue;          // and Black should not be either
      const setup = C.legalMoves(pre).filter(m => C.toUCI(m) === C.name(j) + C.name(i))[0];
      if (!setup) continue;
      /* after that Black move we must reach exactly the puzzle position */
      C.make(pre, setup);
      const same = C.toFEN(pre).split(' ')[0] === fen.split(' ')[0];
      C.unmake(pre);
      if (!same) continue;
      /* and the whole line must still mate */
      if (!replayMates(fenBack, [C.name(j) + C.name(i)].concat(line))) continue;
      return { fen: fenBack, setup: C.name(j) + C.name(i) };
    }
  }
  return null;
}

puzzles.sort((a, b) => a.rating - b.rating);
puzzles.forEach((p, i) => { p.id = 'nx' + String(i + 1).padStart(4, '0'); });

/* ---- write in batches so the browser never loads the lot at once ---- */
const OUT = new URL('../assets/puzzles/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

/* Refuse to replace a larger existing set with a smaller one. A short test
   run should never wipe the real collection — pass --force if that is
   genuinely what you want. */
let existing = 0;
for (const f of fs.readdirSync(OUT)) {
  if (!/^nexus-\d+\.json$/.test(f)) continue;
  try { existing += JSON.parse(fs.readFileSync(new URL(f, OUT), 'utf8')).length; } catch {}
}
if (existing > puzzles.length && !process.argv.includes('--force')) {
  console.error(`
Refusing to overwrite: ${existing} puzzles already on disk, this run produced only ${puzzles.length}.`);
  console.error('Nothing was written. Raise the count or the time budget, or pass --force to replace anyway.');
  process.exit(1);
}
for (const f of fs.readdirSync(OUT)) {
  if (/^nexus-\d+\.json$/.test(f)) fs.unlinkSync(new URL(f, OUT));
}

const SIZE = 25;
const batches = [];
for (let i = 0; i < puzzles.length; i += SIZE) {
  const part = puzzles.slice(i, i + SIZE);
  const file = 'nexus-' + String(batches.length + 1).padStart(2, '0') + '.json';
  fs.writeFileSync(new URL(file, OUT), JSON.stringify(part));
  batches.push({
    file,
    count: part.length,
    minRating: part[0].rating,
    maxRating: part[part.length - 1].rating
  });
}

/* Also emit the whole starter set as a plain script. Fetch is blocked on
   file:// URLs, so without this the page only works behind a web server.
   Loaded as <script>, it works when the file is simply opened. The batches
   above are still used when the site is served, and any imported Lichess
   data — which is far too big to embed — is always fetched. */
fs.writeFileSync(new URL('../puzzles-embedded.js', OUT),
  ['/* Generated by tools/generate-puzzles.mjs - do not edit by hand.',
   '   The starter puzzle set, embedded so rush.html works from the file',
   '   system as well as over http. ' + puzzles.length + ' puzzles. */',
   'window.NexusPuzzleSeed = ' + JSON.stringify(puzzles) + ';',
   ''].join(String.fromCharCode(10)));

fs.writeFileSync(new URL('index.json', OUT), JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  sources: [{
    name: 'nexus-composed',
    note: 'Composed by tools/generate-puzzles.mjs, verified with assets/chess-core.js. Not Lichess data.',
    total: puzzles.length,
    batches
  }]
}, null, 2));

const byBand = {};
for (const p of puzzles) {
  const k = p.rating < 1000 ? '<1000' : p.rating < 1400 ? '1000-1399' : p.rating < 1800 ? '1400-1799' : '1800+';
  byBand[k] = (byBand[k] || 0) + 1;
}
console.log(puzzles.length + ' puzzles from ' + tries.toLocaleString() + ' attempts (' + depth3Tries.toLocaleString() + ' reached the depth-3 search) in ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
console.log('by rating :', JSON.stringify(byBand));
console.log('mate in 1 :', puzzles.filter(p => p.mateIn === 1).length);
console.log('mate in 2 :', puzzles.filter(p => p.mateIn === 2).length);
console.log('mate in 3 :', puzzles.filter(p => p.mateIn === 3).length);
console.log('batches   :', batches.length, '->', batches.map(b => b.file).join(', '));
console.log('embedded  : assets/puzzles-embedded.js (' + Math.round(fs.statSync(new URL('../puzzles-embedded.js', OUT)).size / 1024) + ' KB)');
