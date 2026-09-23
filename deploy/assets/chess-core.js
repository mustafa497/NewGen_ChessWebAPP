/* Nexus Chess Academy — chess-core.js
   Complete chess rules: legal move generation, castling, en passant,
   promotion, check / checkmate / stalemate, FEN in and out, UCI and SAN.

   No dependencies and no build step, because the site is plain static files
   uploaded as-is. Correctness is not taken on trust: tools/perft.mjs walks
   the published perft node counts for six standard positions, which is the
   accepted way to prove a move generator handles every edge case.

   Board is 64 entries, index 0 = a8 through 63 = h1 (FEN reading order).
   Row 0 is rank 8, so White advances toward row 0. */
(function (global) {
  'use strict';

  var FILES = 'abcdefgh';
  var EMPTY = null;

  function fileOf(i) { return i & 7; }
  function rowOf(i)  { return i >> 3; }
  function sq(f, r)  { return (r << 3) + f; }
  function ok(f, r)  { return f >= 0 && f < 8 && r >= 0 && r < 8; }
  function name(i)   { return FILES[fileOf(i)] + (8 - rowOf(i)); }
  function index(n)  { return sq(FILES.indexOf(n[0]), 8 - parseInt(n[1], 10)); }

  function isWhite(p) { return p !== EMPTY && p < 'a'; }   // uppercase sorts before 'a'
  function colorOf(p) { return isWhite(p) ? 'w' : 'b'; }

  var KNIGHT_D = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
  var DIAG_D   = [[1,1],[1,-1],[-1,1],[-1,-1]];
  var ORTHO_D  = [[1,0],[-1,0],[0,1],[0,-1]];
  var KING_D   = DIAG_D.concat(ORTHO_D);

  /* ------------------------------------------------------------------ */
  /* position                                                            */
  /* ------------------------------------------------------------------ */

  function fromFEN(fen) {
    var parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4) throw new Error('bad FEN: ' + fen);

    var b = new Array(64).fill(EMPTY), i = 0;
    var rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('bad FEN ranks: ' + fen);
    for (var r = 0; r < 8; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row[c];
        if (ch >= '1' && ch <= '8') i += +ch;
        else b[i++] = ch;
      }
    }
    if (i !== 64) throw new Error('bad FEN square count: ' + fen);

    var st = {
      b: b,
      turn: parts[1] === 'b' ? 'b' : 'w',
      cast: {
        wk: parts[2].indexOf('K') >= 0, wq: parts[2].indexOf('Q') >= 0,
        bk: parts[2].indexOf('k') >= 0, bq: parts[2].indexOf('q') >= 0
      },
      ep: parts[3] && parts[3] !== '-' ? index(parts[3]) : null,
      half: parts.length > 4 ? +parts[4] : 0,
      full: parts.length > 5 ? +parts[5] : 1,
      kings: { w: -1, b: -1 },
      undo: []
    };
    for (var k = 0; k < 64; k++) {
      if (b[k] === 'K') st.kings.w = k;
      else if (b[k] === 'k') st.kings.b = k;
    }
    return st;
  }

  function toFEN(st) {
    var out = '';
    for (var r = 0; r < 8; r++) {
      var run = 0;
      for (var f = 0; f < 8; f++) {
        var p = st.b[sq(f, r)];
        if (p === EMPTY) run++;
        else { if (run) { out += run; run = 0; } out += p; }
      }
      if (run) out += run;
      if (r < 7) out += '/';
    }
    var c = (st.cast.wk ? 'K' : '') + (st.cast.wq ? 'Q' : '') +
            (st.cast.bk ? 'k' : '') + (st.cast.bq ? 'q' : '');
    return out + ' ' + st.turn + ' ' + (c || '-') + ' ' +
           (st.ep === null ? '-' : name(st.ep)) + ' ' + st.half + ' ' + st.full;
  }

  function clone(st) {
    return {
      b: st.b.slice(), turn: st.turn,
      cast: { wk: st.cast.wk, wq: st.cast.wq, bk: st.cast.bk, bq: st.cast.bq },
      ep: st.ep, half: st.half, full: st.full,
      kings: { w: st.kings.w, b: st.kings.b },
      undo: []
    };
  }

  /* ------------------------------------------------------------------ */
  /* attack detection — asked directly rather than by generating moves,   */
  /* because castling and legality checks lean on it heavily              */
  /* ------------------------------------------------------------------ */

  function isAttacked(st, target, by) {
    var b = st.b, white = by === 'w';
    var tf = fileOf(target), tr = rowOf(target);

    /* pawns: a white pawn on row+1 attacks upward into `target` */
    var pr = white ? tr + 1 : tr - 1;
    var pawn = white ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (tf > 0 && b[sq(tf - 1, pr)] === pawn) return true;
      if (tf < 7 && b[sq(tf + 1, pr)] === pawn) return true;
    }

    var i, d, f, r, p;
    var knight = white ? 'N' : 'n';
    for (i = 0; i < 8; i++) {
      d = KNIGHT_D[i]; f = tf + d[0]; r = tr + d[1];
      if (ok(f, r) && b[sq(f, r)] === knight) return true;
    }

    var king = white ? 'K' : 'k';
    for (i = 0; i < 8; i++) {
      d = KING_D[i]; f = tf + d[0]; r = tr + d[1];
      if (ok(f, r) && b[sq(f, r)] === king) return true;
    }

    var bishop = white ? 'B' : 'b', rook = white ? 'R' : 'r', queen = white ? 'Q' : 'q';
    for (i = 0; i < 4; i++) {
      d = DIAG_D[i]; f = tf + d[0]; r = tr + d[1];
      while (ok(f, r)) {
        p = b[sq(f, r)];
        if (p !== EMPTY) { if (p === bishop || p === queen) return true; break; }
        f += d[0]; r += d[1];
      }
    }
    for (i = 0; i < 4; i++) {
      d = ORTHO_D[i]; f = tf + d[0]; r = tr + d[1];
      while (ok(f, r)) {
        p = b[sq(f, r)];
        if (p !== EMPTY) { if (p === rook || p === queen) return true; break; }
        f += d[0]; r += d[1];
      }
    }
    return false;
  }

  function inCheck(st, color) {
    var c = color || st.turn;
    var k = st.kings[c];
    return k >= 0 && isAttacked(st, k, c === 'w' ? 'b' : 'w');
  }

  /* ------------------------------------------------------------------ */
  /* move generation                                                     */
  /* ------------------------------------------------------------------ */

  var PROMOS = ['q', 'r', 'b', 'n'];

  function pseudoMoves(st) {
    var b = st.b, white = st.turn === 'w', out = [];
    var mine = white ? /[A-Z]/ : /[a-z]/;

    function add(from, to, promo, flag) {
      out.push({ from: from, to: to, promo: promo || null, flag: flag || null });
    }
    function empty(i) { return b[i] === EMPTY; }
    function enemy(i) { return b[i] !== EMPTY && isWhite(b[i]) !== white; }

    for (var i = 0; i < 64; i++) {
      var p = b[i];
      if (p === EMPTY || !mine.test(p)) continue;
      var t = p.toLowerCase(), f = fileOf(i), r = rowOf(i), d, nf, nr, j;

      if (t === 'p') {
        var dr = white ? -1 : 1;
        var startRow = white ? 6 : 1;
        var lastRow  = white ? 0 : 7;

        nr = r + dr;
        if (ok(f, nr) && empty(sq(f, nr))) {
          if (nr === lastRow) for (j = 0; j < 4; j++) add(i, sq(f, nr), PROMOS[j]);
          else {
            add(i, sq(f, nr));
            var nr2 = r + 2 * dr;
            if (r === startRow && empty(sq(f, nr2))) add(i, sq(f, nr2), null, 'double');
          }
        }
        for (var s = -1; s <= 1; s += 2) {
          nf = f + s; nr = r + dr;
          if (!ok(nf, nr)) continue;
          var to = sq(nf, nr);
          if (enemy(to)) {
            if (nr === lastRow) for (j = 0; j < 4; j++) add(i, to, PROMOS[j]);
            else add(i, to);
          } else if (st.ep !== null && to === st.ep) {
            add(i, to, null, 'ep');
          }
        }
      }
      else if (t === 'n') {
        for (j = 0; j < 8; j++) {
          d = KNIGHT_D[j]; nf = f + d[0]; nr = r + d[1];
          if (ok(nf, nr) && (empty(sq(nf, nr)) || enemy(sq(nf, nr)))) add(i, sq(nf, nr));
        }
      }
      else if (t === 'k') {
        for (j = 0; j < 8; j++) {
          d = KING_D[j]; nf = f + d[0]; nr = r + d[1];
          if (ok(nf, nr) && (empty(sq(nf, nr)) || enemy(sq(nf, nr)))) add(i, sq(nf, nr));
        }
        /* castling: king and rook unmoved, path clear, king not passing
           through or landing on an attacked square */
        var them = white ? 'b' : 'w';
        var home = white ? 60 : 4;                     // e1 / e8
        if (i === home && !isAttacked(st, home, them)) {
          var kSide = white ? st.cast.wk : st.cast.bk;
          var qSide = white ? st.cast.wq : st.cast.bq;
          if (kSide && empty(home + 1) && empty(home + 2) &&
              !isAttacked(st, home + 1, them) && !isAttacked(st, home + 2, them)) {
            add(i, home + 2, null, 'castle-k');
          }
          if (qSide && empty(home - 1) && empty(home - 2) && empty(home - 3) &&
              !isAttacked(st, home - 1, them) && !isAttacked(st, home - 2, them)) {
            add(i, home - 2, null, 'castle-q');
          }
        }
      }
      else {
        var dirs = t === 'b' ? DIAG_D : t === 'r' ? ORTHO_D : KING_D;
        for (j = 0; j < dirs.length; j++) {
          d = dirs[j]; nf = f + d[0]; nr = r + d[1];
          while (ok(nf, nr)) {
            var k2 = sq(nf, nr);
            if (empty(k2)) add(i, k2);
            else { if (enemy(k2)) add(i, k2); break; }
            nf += d[0]; nr += d[1];
          }
        }
      }
    }
    return out;
  }

  function make(st, m) {
    var b = st.b, piece = b[m.from];
    var white = isWhite(piece);
    var rec = {
      m: m, piece: piece, captured: b[m.to],
      cast: { wk: st.cast.wk, wq: st.cast.wq, bk: st.cast.bk, bq: st.cast.bq },
      ep: st.ep, half: st.half, full: st.full,
      kingFrom: st.kings[white ? 'w' : 'b'],
      epCapturedAt: -1, rookFrom: -1, rookTo: -1
    };

    b[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : piece;
    b[m.from] = EMPTY;

    if (m.flag === 'ep') {
      var capSq = sq(fileOf(m.to), rowOf(m.from));
      rec.epCapturedAt = capSq;
      rec.captured = b[capSq];
      b[capSq] = EMPTY;
    }
    else if (m.flag === 'castle-k') {
      rec.rookFrom = m.to + 1; rec.rookTo = m.to - 1;
      b[rec.rookTo] = b[rec.rookFrom]; b[rec.rookFrom] = EMPTY;
    }
    else if (m.flag === 'castle-q') {
      rec.rookFrom = m.to - 2; rec.rookTo = m.to + 1;
      b[rec.rookTo] = b[rec.rookFrom]; b[rec.rookFrom] = EMPTY;
    }

    if (piece === 'K') { st.kings.w = m.to; st.cast.wk = st.cast.wq = false; }
    else if (piece === 'k') { st.kings.b = m.to; st.cast.bk = st.cast.bq = false; }

    /* a rook leaving or being captured on its home square kills that right */
    if (m.from === 63 || m.to === 63) st.cast.wk = false;
    if (m.from === 56 || m.to === 56) st.cast.wq = false;
    if (m.from === 7  || m.to === 7)  st.cast.bk = false;
    if (m.from === 0  || m.to === 0)  st.cast.bq = false;

    st.ep = m.flag === 'double' ? sq(fileOf(m.from), (rowOf(m.from) + rowOf(m.to)) / 2) : null;
    st.half = (piece.toLowerCase() === 'p' || rec.captured !== EMPTY) ? 0 : st.half + 1;
    if (!white) st.full++;
    st.turn = white ? 'b' : 'w';
    st.undo.push(rec);
    return st;
  }

  function unmake(st) {
    var rec = st.undo.pop();
    if (!rec) return st;
    var b = st.b, m = rec.m;

    b[m.from] = rec.piece;
    b[m.to] = EMPTY;
    if (rec.epCapturedAt >= 0) b[rec.epCapturedAt] = rec.captured;
    else b[m.to] = rec.captured;

    if (rec.rookFrom >= 0) { b[rec.rookFrom] = b[rec.rookTo]; b[rec.rookTo] = EMPTY; }

    if (rec.piece === 'K') st.kings.w = rec.kingFrom;
    else if (rec.piece === 'k') st.kings.b = rec.kingFrom;

    st.cast = rec.cast; st.ep = rec.ep; st.half = rec.half; st.full = rec.full;
    st.turn = isWhite(rec.piece) ? 'w' : 'b';
    return st;
  }

  function legalMoves(st) {
    var all = pseudoMoves(st), out = [], me = st.turn;
    for (var i = 0; i < all.length; i++) {
      make(st, all[i]);
      if (!inCheck(st, me)) out.push(all[i]);
      unmake(st);
    }
    return out;
  }

  function isCheckmate(st) { return inCheck(st) && legalMoves(st).length === 0; }
  function isStalemate(st) { return !inCheck(st) && legalMoves(st).length === 0; }

  /* ------------------------------------------------------------------ */
  /* notation                                                            */
  /* ------------------------------------------------------------------ */

  function toUCI(m) { return name(m.from) + name(m.to) + (m.promo || ''); }

  function fromUCI(st, uci) {
    var from = index(uci.slice(0, 2)), to = index(uci.slice(2, 4));
    var promo = uci.length > 4 ? uci[4].toLowerCase() : null;
    var moves = legalMoves(st);
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      if (m.from === from && m.to === to && (m.promo || null) === (promo || m.promo || null)) return m;
    }
    /* a promotion written without a piece letter is taken as a queen */
    if (!promo) {
      for (var j = 0; j < moves.length; j++) {
        if (moves[j].from === from && moves[j].to === to && moves[j].promo === 'q') return moves[j];
      }
    }
    return null;
  }

  function toSAN(st, m) {
    if (m.flag === 'castle-k') return decorate(st, m, 'O-O');
    if (m.flag === 'castle-q') return decorate(st, m, 'O-O-O');

    var piece = st.b[m.from], t = piece.toLowerCase();
    var capture = st.b[m.to] !== EMPTY || m.flag === 'ep';
    var s = '';

    if (t === 'p') {
      if (capture) s += FILES[fileOf(m.from)] + 'x';
      s += name(m.to);
      if (m.promo) s += '=' + m.promo.toUpperCase();
    } else {
      s += piece.toUpperCase();
      /* disambiguate only as far as needed */
      var others = legalMoves(st).filter(function (o) {
        return o.to === m.to && o.from !== m.from &&
               st.b[o.from] === piece;
      });
      if (others.length) {
        var sameFile = others.some(function (o) { return fileOf(o.from) === fileOf(m.from); });
        var sameRank = others.some(function (o) { return rowOf(o.from) === rowOf(m.from); });
        if (!sameFile) s += FILES[fileOf(m.from)];
        else if (!sameRank) s += (8 - rowOf(m.from));
        else s += name(m.from);
      }
      if (capture) s += 'x';
      s += name(m.to);
    }
    return decorate(st, m, s);
  }

  function decorate(st, m, s) {
    make(st, m);
    if (inCheck(st)) s += legalMoves(st).length === 0 ? '#' : '+';
    unmake(st);
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* perft — the correctness proof, exposed so tools can call it          */
  /* ------------------------------------------------------------------ */

  function perft(st, depth) {
    if (depth === 0) return 1;
    var moves = legalMoves(st), n = 0;
    if (depth === 1) return moves.length;
    for (var i = 0; i < moves.length; i++) {
      make(st, moves[i]);
      n += perft(st, depth - 1);
      unmake(st);
    }
    return n;
  }

  global.NexusChess = {
    fromFEN: fromFEN, toFEN: toFEN, clone: clone,
    legalMoves: legalMoves, make: make, unmake: unmake,
    inCheck: inCheck, isAttacked: isAttacked,
    isCheckmate: isCheckmate, isStalemate: isStalemate,
    toUCI: toUCI, fromUCI: fromUCI, toSAN: toSAN,
    name: name, index: index, fileOf: fileOf, rowOf: rowOf,
    isWhite: isWhite, colorOf: colorOf, perft: perft
  };

})(typeof window !== 'undefined' ? window : globalThis);
