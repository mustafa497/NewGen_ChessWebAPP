/* Proves assets/chess-core.js generates moves correctly.
   Perft counts every leaf node at a given depth; these six positions and
   their node counts are the standard published set, chosen because between
   them they exercise castling, en passant, promotion, pins, discovered
   check and double check. Any rule bug changes the totals.
   Run: node tools/perft.mjs [--deep] */
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../assets/chess-core.js', import.meta.url), 'utf8');
new Function(src).call(globalThis);
const C = globalThis.NexusChess;

const SUITE = [
  { name:'initial position', fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    counts:[20, 400, 8902, 197281, 4865609] },
  { name:'kiwipete',         fen:'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    counts:[48, 2039, 97862, 4085603] },
  { name:'endgame (ep)',     fen:'8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    counts:[14, 191, 2812, 43238, 674624] },
  { name:'promotion tangle', fen:'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts:[6, 264, 9467, 422333] },
  { name:'position 5',       fen:'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    counts:[44, 1486, 62379, 2103487] },
  { name:'position 6',       fen:'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    counts:[46, 2079, 89890, 3894594] }
];

const deep = process.argv.includes('--deep');
let fails = 0, totalNodes = 0;
const t0 = Date.now();

for (const pos of SUITE) {
  const limit = deep ? pos.counts.length : Math.min(pos.counts.length, 3);
  for (let d = 1; d <= limit; d++) {
    const st = C.fromFEN(pos.fen);
    const started = Date.now();
    const got = C.perft(st, d);
    const want = pos.counts[d - 1];
    totalNodes += got;
    const ms = Date.now() - started;
    if (got === want) {
      console.log(`ok   ${pos.name.padEnd(18)} depth ${d}  ${String(got).padStart(9)} nodes  ${String(ms).padStart(6)}ms`);
    } else {
      fails++;
      console.log(`FAIL ${pos.name.padEnd(18)} depth ${d}  got ${got}, expected ${want}  (off by ${got - want})`);
    }
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n${totalNodes.toLocaleString()} nodes in ${secs}s`);
console.log(fails ? `${fails} perft check(s) FAILED` : `all perft checks passed${deep ? '' : '  (run with --deep for full depth)'}`);
process.exit(fails ? 1 : 0);
