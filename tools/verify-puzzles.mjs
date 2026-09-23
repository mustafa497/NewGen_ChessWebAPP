/* Replays every puzzle solution through the engine in assets/puzzles.js and
   asserts it is legal and really ends in mate. Run: node tools/verify-puzzles.mjs */
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../assets/puzzles.js', import.meta.url), 'utf8');
new Function(src).call(globalThis);          // no document -> engine + data only

const { ENGINE, PUZZLES } = globalThis.NexusPuzzles;
const { parseFEN, legalMoves, apply, isCheckmate, inCheck, parseMove, moveText } = ENGINE;

let bad = 0;
for (const p of PUZZLES) {
  const problems = [];
  let s = parseFEN(p.fen);

  const kings = s.board.filter(x => x === 'K' || x === 'k').length;
  if (kings !== 2) problems.push(`expected two kings, found ${kings}`);
  if (inCheck(s, s.turn === 'w' ? 'b' : 'w')) problems.push('side not to move is already in check');
  if (p.solution.length % 2 !== 1) problems.push('solution should end on the solver\'s move');

  p.solution.forEach((txt, i) => {
    if (problems.length) return;
    const legal = legalMoves(s, s.turn).map(moveText);
    const want = txt.length === 5 ? txt : txt;
    const match = legal.includes(want) || legal.includes(want + 'q');
    if (!match) { problems.push(`move ${i + 1} "${txt}" is not legal (${legal.length} legal moves)`); return; }
    s = apply(s, parseMove(txt));
  });

  if (!problems.length) {
    if (!isCheckmate(s)) problems.push('final position is not checkmate');
  }

  // the defence's reply must be forced, or the "mate in two" is not a mate in two
  if (!problems.length && p.solution.length === 3) {
    let t = parseFEN(p.fen);
    t = apply(t, parseMove(p.solution[0]));
    const replies = legalMoves(t, t.turn).map(moveText);
    if (replies.length !== 1) problems.push(`defence has ${replies.length} replies (${replies.join(', ')}), not forced`);
  }

  if (problems.length) { bad++; console.log(`FAIL ${p.id.padEnd(6)} ${p.theme}`); problems.forEach(x => console.log(`       - ${x}`)); }
  else console.log(`ok   ${p.id.padEnd(6)} ${p.theme.padEnd(20)} ${p.solution.join(' ')}`);
}
console.log(bad ? `\n${bad} of ${PUZZLES.length} puzzles FAILED` : `\nall ${PUZZLES.length} puzzles verified`);
process.exit(bad ? 1 : 0);
