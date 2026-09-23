/* Replays the Rush selector against the real puzzle set and checks that a
   run actually climbs: 1-10 mate in one, 11-20 mate in two, 21+ mate in
   three. Runs the selector code as the browser runs it, by lifting the
   three functions out of assets/rush.js rather than reimplementing them. */
import fs from 'node:fs';

const src = fs.readFileSync('assets/rush.js', 'utf8');

/* pull the selector out of the data module verbatim */
const grab = (name) => {
  const at = src.indexOf(`      ${name}: function (`);
  if (at < 0) throw new Error(`could not find ${name} in rush.js`);
  let i = src.indexOf('{', src.indexOf(')', at));
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return src.slice(at + 6, j + 1); }
  }
  throw new Error(`unbalanced ${name}`);
};

const DIR = process.argv[2] || 'assets/puzzles';
const all = [];
const index = JSON.parse(fs.readFileSync(`${DIR}/index.json`, 'utf8'));
for (const src of index.sources) {
  for (const b of src.batches) {
    const raw = JSON.parse(fs.readFileSync(`${DIR}/${b.file}`, 'utf8'));
    all.push(...(Array.isArray(raw) ? raw : raw.puzzles));
  }
}

const selector = new Function('all', `
  var data = { ${grab('depthOf')}, ${grab('stageFor')}, ${grab('next')} };
  return data;
`)(all);

console.log(`set: ${all.length} puzzles`);
const byDepth = {};
all.forEach(p => { const d = selector.depthOf(p); byDepth[d] = (byDepth[d] || 0) + 1; });
console.log('by depth:', byDepth);

let bad = 0;
const RUNS = Number(process.argv[3]) || 400, LEN = Number(process.argv[4]) || 30;
const stageHits = { 1: {}, 2: {}, 3: {} };
const ratingAt = {};

for (let r = 0; r < RUNS; r++) {
  const used = {};
  for (let solved = 0; solved < LEN; solved++) {
    const p = selector.next(solved, used);
    if (!p) { console.log(`run ${r}: set exhausted at ${solved}`); break; }
    used[p.id] = true;
    const d = selector.depthOf(p);
    const want = selector.stageFor(solved);
    const avail = all.filter(x => !used[x.id] || x.id === p.id).some(x => selector.depthOf(x) === want);
    stageHits[want][d] = (stageHits[want][d] || 0) + 1;
    (ratingAt[solved] = ratingAt[solved] || []).push(p.rating);
    if (avail && d !== want) {
      if (bad++ < 6) console.log(`  MISMATCH run ${r} puzzle ${solved + 1}: wanted M${want}, got M${d} (${p.id})`);
    }
  }
}

console.log(`\nover ${RUNS} runs of ${LEN}:`);
for (const want of [1, 2, 3]) {
  const hits = stageHits[want];
  const total = Object.values(hits).reduce((a, b) => a + b, 0);
  const exact = hits[want] || 0;
  console.log(`  stage M${want}: ${((exact / total) * 100).toFixed(1)}% on target  ${JSON.stringify(hits)}`);
}
const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(String.fromCharCode(10) + 'mean rating by position:');
let row = '  ';
for (let i = 0; i < LEN; i++) {
  if (!ratingAt[i]) break;
  row += String(i + 1).padStart(3) + ':' + avg(ratingAt[i]) + '  ';
  if ((i + 1) % 10 === 0) { console.log(row); row = '  '; }
}
if (row.trim()) console.log(row);

console.log(bad ? `\n${bad} mismatches while the wanted depth was still available` : '\nno mismatches while stock lasted');
process.exit(bad ? 1 : 0);
