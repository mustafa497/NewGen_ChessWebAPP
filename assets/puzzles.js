/* Nexus Chess Academy — the Puzzle Lab.
   Loaded only by puzzles.html. Three parts: a small chess engine, the puzzle
   set, and the interface. The engine is deliberately kept free of any DOM
   reference so it can be loaded in Node and used to verify every puzzle. */
(function (global) {
  'use strict';

  /* =====================================================================
     ENGINE
     Board is 64 entries, index 0 = a8 through 63 = h1, matching FEN order.
     Uppercase is White, lowercase is Black, null is an empty square.
     Castling and en passant are not generated — no puzzle in the set needs
     either, and leaving them out keeps the rules easy to audit.
     ===================================================================== */

  var FILES = 'abcdefgh';

  function fileOf(i) { return i % 8; }
  function rowOf(i)  { return (i / 8) | 0; }          // row 0 is rank 8
  function idx(f, r) { return r * 8 + f; }
  function onBoard(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }

  function square(i) { return FILES[fileOf(i)] + (8 - rowOf(i)); }
  function toIndex(name) {
    return idx(FILES.indexOf(name[0]), 8 - parseInt(name[1], 10));
  }

  function isWhite(p) { return !!p && p === p.toUpperCase(); }
  function sameSide(a, b) { return !!a && !!b && isWhite(a) === isWhite(b); }

  function parseFEN(fen) {
    var parts = fen.trim().split(/\s+/);
    var board = new Array(64).fill(null);
    var i = 0;
    parts[0].split('').forEach(function (ch) {
      if (ch === '/') return;
      if (/\d/.test(ch)) { i += parseInt(ch, 10); return; }
      board[i++] = ch;
    });
    return { board: board, turn: parts[1] === 'b' ? 'b' : 'w' };
  }

  var KNIGHT = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
  var DIAG   = [[1,1],[1,-1],[-1,1],[-1,-1]];
  var ORTHO  = [[1,0],[-1,0],[0,1],[0,-1]];

  /* Every move the side to move could make if the king were not a concern. */
  function pseudoMoves(state, color) {
    var board = state.board, out = [];
    var white = color === 'w';

    function push(from, to, promo) { out.push({ from: from, to: to, promo: promo || null }); }

    function slide(from, dirs) {
      var f = fileOf(from), r = rowOf(from);
      dirs.forEach(function (d) {
        var nf = f + d[0], nr = r + d[1];
        while (onBoard(nf, nr)) {
          var to = idx(nf, nr), target = board[to];
          if (!target) push(from, to);
          else { if (!sameSide(board[from], target)) push(from, to); break; }
          nf += d[0]; nr += d[1];
        }
      });
    }

    function step(from, dirs) {
      var f = fileOf(from), r = rowOf(from);
      dirs.forEach(function (d) {
        var nf = f + d[0], nr = r + d[1];
        if (!onBoard(nf, nr)) return;
        var to = idx(nf, nr);
        if (!sameSide(board[from], board[to])) push(from, to);
      });
    }

    for (var i = 0; i < 64; i++) {
      var p = board[i];
      if (!p || isWhite(p) !== white) continue;
      var t = p.toLowerCase();
      var f = fileOf(i), r = rowOf(i);

      if (t === 'p') {
        var dr = white ? -1 : 1;                 // White marches toward row 0
        var startRow = white ? 6 : 1;
        var lastRow  = white ? 0 : 7;
        var one = idx(f, r + dr);
        if (onBoard(f, r + dr) && !board[one]) {
          if (r + dr === lastRow) ['q','r','b','n'].forEach(function (pr) { push(i, one, pr); });
          else push(i, one);
          var two = idx(f, r + 2 * dr);
          if (r === startRow && !board[two]) push(i, two);
        }
        [-1, 1].forEach(function (df) {
          var nf = f + df, nr = r + dr;
          if (!onBoard(nf, nr)) return;
          var to = idx(nf, nr), target = board[to];
          if (target && !sameSide(p, target)) {
            if (nr === lastRow) ['q','r','b','n'].forEach(function (pr) { push(i, to, pr); });
            else push(i, to);
          }
        });
      }
      else if (t === 'n') step(i, KNIGHT);
      else if (t === 'b') slide(i, DIAG);
      else if (t === 'r') slide(i, ORTHO);
      else if (t === 'q') slide(i, DIAG.concat(ORTHO));
      else if (t === 'k') step(i, DIAG.concat(ORTHO));
    }
    return out;
  }

  function apply(state, move) {
    var board = state.board.slice();
    var piece = board[move.from];
    board[move.to] = move.promo ? (isWhite(piece) ? move.promo.toUpperCase() : move.promo) : piece;
    board[move.from] = null;
    return { board: board, turn: state.turn === 'w' ? 'b' : 'w' };
  }

  function kingSquare(state, color) {
    var want = color === 'w' ? 'K' : 'k';
    for (var i = 0; i < 64; i++) if (state.board[i] === want) return i;
    return -1;
  }

  function inCheck(state, color) {
    var k = kingSquare(state, color);
    if (k < 0) return false;
    var them = color === 'w' ? 'b' : 'w';
    return pseudoMoves(state, them).some(function (m) { return m.to === k; });
  }

  /* Pseudo-legal minus anything that leaves your own king attacked. */
  function legalMoves(state, color) {
    var side = color || state.turn;
    return pseudoMoves(state, side).filter(function (m) {
      return !inCheck(apply(state, m), side);
    });
  }

  function isCheckmate(state) {
    return inCheck(state, state.turn) && legalMoves(state, state.turn).length === 0;
  }

  function isStalemate(state) {
    return !inCheck(state, state.turn) && legalMoves(state, state.turn).length === 0;
  }

  /* "e2e4" or "e7e8q" */
  function parseMove(text) {
    return {
      from: toIndex(text.slice(0, 2)),
      to: toIndex(text.slice(2, 4)),
      promo: text.length > 4 ? text[4] : null
    };
  }
  function moveText(m) {
    return square(m.from) + square(m.to) + (m.promo || '');
  }

  var ENGINE = {
    parseFEN: parseFEN, legalMoves: legalMoves, apply: apply,
    inCheck: inCheck, isCheckmate: isCheckmate, isStalemate: isStalemate,
    square: square, toIndex: toIndex, parseMove: parseMove, moveText: moveText,
    isWhite: isWhite
  };

  /* =====================================================================
     THE PUZZLE SET
     These are composed training positions, not extracts from named games —
     nothing here is attributed to a player or an event. Every solution is
     checked by tools/verify-puzzles.mjs, which replays it through the engine
     above and asserts the finish really is mate.
     ===================================================================== */
  var PUZZLES = [
    { id:'br-1', fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solution:['e1e8'],
      theme:'Back-rank mate', piece:'Rook', rating:800,
      idea:'The pawns in front of the king are its own cage. A rook arriving on the empty back rank ends it.' },

    { id:'sm-1', fen:'6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solution:['g5f7'],
      theme:'Smothered mate', piece:'Knight', rating:1000,
      idea:'Every flight square is taken by the defender’s own men, so one knight is enough.' },

    { id:'qk-1', fen:'7k/8/6K1/8/8/8/8/1Q6 w - - 0 1', solution:['b1b8'],
      theme:'Queen and king', piece:'Queen', rating:700,
      idea:'The queen takes the back rank while your own king covers the two squares in front.' },

    { id:'ld-1', fen:'7k/R7/8/8/8/8/8/1R5K w - - 0 1', solution:['b1b8'],
      theme:'Ladder mate', piece:'Rook', rating:750,
      idea:'One rook seals the rank below, the second delivers on the rank above.' },

    { id:'br-2', fen:'3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solution:['d1d8'],
      theme:'Back-rank mate', piece:'Rook', rating:900,
      idea:'A rook stands opposite yours. Count who takes last before you commit to the file.' },

    { id:'an-1', fen:'7k/6pp/8/8/8/8/8/5R1K w - - 0 1', solution:['f1f8'],
      theme:'Back-rank mate', piece:'Rook', rating:800,
      idea:'The pawns never moved, so the back rank is the only road — and it is open.' },

    { id:'bs-1', fen:'6k1/5p2/8/8/8/8/8/B5KR w - - 0 1', solution:['h1h8'],
      theme:'Rook and bishop', piece:'Rook', rating:1050,
      idea:'The bishop guards the landing square from the far corner, so the rook cannot be taken.' },

    { id:'ar-1', fen:'7k/R7/5N2/8/8/8/8/6K1 w - - 0 1', solution:['a7h7'],
      theme:'Arabian mate', piece:'Rook', rating:1150,
      idea:'Rook and knight together: the knight defends the rook and covers the corner’s only exit.' },

    { id:'qm-1', fen:'6k1/8/6K1/8/3Q4/8/8/8 w - - 0 1', solution:['d4g7'],
      theme:'Supported queen mate', piece:'Queen', rating:950,
      idea:'The queen steps right beside the king — legal only because your king defends her there.' },

    { id:'bb-1', fen:'7k/8/6K1/8/8/8/B7/2B5 w - - 0 1', solution:['c1b2'],
      theme:'Two bishops', piece:'Bishop', rating:1200,
      idea:'One bishop takes the long diagonal, the other cuts the escape square beside it.' },

    { id:'pr-1', fen:'7k/5P2/6P1/8/8/B7/8/6K1 w - - 0 1', solution:['f7f8q'],
      theme:'Promotion', piece:'Pawn', rating:1100,
      idea:'A pawn on the seventh is a queen waiting. Promote with check and the corner is sealed.' },

    { id:'kn-2', fen:'6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1', solution:['e5f7'],
      theme:'Smothered mate', piece:'Knight', rating:1100,
      idea:'The same smothered pattern from one square further out — find the route in.' },

    { id:'br-3', fen:'7k/5ppp/8/8/8/8/8/4R1K1 w - - 0 1', solution:['e1e8'],
      theme:'Back-rank mate', piece:'Rook', rating:760,
      idea:'Same cage, king in the corner. The rook does not need to come close.' },

    { id:'br-4', fen:'6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1', solution:['d1d8'],
      theme:'Back-rank mate', piece:'Queen', rating:780,
      idea:'A queen mates on the back rank exactly as a rook does — the extra diagonals are spare.' },

    { id:'rk-1', fen:'4k3/8/4K3/8/8/8/8/R7 w - - 0 1', solution:['a1a8'],
      theme:'Rook and king', piece:'Rook', rating:650,
      idea:'Your king takes the three squares in front; the rook only has to cut the rank.' },

    { id:'qo-1', fen:'4k3/8/4K3/8/8/8/8/1Q6 w - - 0 1', solution:['b1b8'],
      theme:'Queen and king', piece:'Queen', rating:620,
      idea:'The same finish with a queen. Learn the rook version first — it is the one you will need.' },

    { id:'dr-1', fen:'6k1/1R6/8/8/8/8/8/2R4K w - - 0 1', solution:['c1c8'],
      theme:'Double rooks', piece:'Rook', rating:850,
      idea:'One rook holds the seventh so the king cannot step forward; the other takes the eighth.' },

    { id:'qn-1', fen:'7k/Q7/8/5N2/8/8/8/6K1 w - - 0 1', solution:['a7g7'],
      theme:'Queen and knight', piece:'Queen', rating:1150,
      idea:'The queen lands beside the king because the knight, not your king, is defending her.' },

    { id:'ar-2', fen:'k7/1R6/2N5/8/8/8/8/6K1 w - - 0 1', solution:['b7a7'],
      theme:'Arabian mate', piece:'Rook', rating:1200,
      idea:'The Arabian pattern in the other corner. Knight guards the rook, rook seals the rank.' },

    { id:'an-2', fen:'8/4N1pk/8/8/8/K7/8/R7 w - - 0 1', solution:['a1h1'],
      theme:'Anastasia’s mate', piece:'Rook', rating:1350,
      idea:'The knight already covers both squares beside the king. Swing the rook to the open file.' },

    { id:'ep-1', fen:'3rkr2/8/Q7/8/8/8/8/7K w - - 0 1', solution:['a6e6'],
      theme:'Epaulette mate', piece:'Queen', rating:1250,
      idea:'The king is hemmed in by its own rooks — the epaulettes. Come straight down the file.' },

    { id:'bo-1', fen:'2kr4/3p4/8/8/2B2B2/8/8/7K w - - 0 1', solution:['c4a6'],
      theme:'Boden’s mate', piece:'Bishop', rating:1400,
      idea:'Two bishops on crossing diagonals. The defender’s own rook and pawn do the rest.' }
  ];

  global.NexusPuzzles = { ENGINE: ENGINE, PUZZLES: PUZZLES };

  /* Node loads this file purely to verify the set; the interface below is
     only meaningful in a browser. */
  if (typeof document === 'undefined') return;

  /* =====================================================================
     INTERFACE
     ===================================================================== */
  var root = document.getElementById('puzzleLab');
  if (!root) return;

  var GLYPH = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
  var STORE = 'nexus-puzzle-progress';

  var boardEl   = document.getElementById('pzBoard');
  var turnEl    = document.getElementById('pzTurn');
  var themeEl   = document.getElementById('pzTheme');
  var ratingEl  = document.getElementById('pzRating');
  var ideaEl    = document.getElementById('pzIdea');
  var statusEl  = document.getElementById('pzStatus');
  var counterEl = document.getElementById('pzCounter');
  var similarEl = document.getElementById('pzSimilar');
  var modeEls   = Array.prototype.slice.call(document.querySelectorAll('.pz-mode[data-mode]'));
  var filterWrap= document.getElementById('pzFilters');

  var stats = load();
  var mode = 'mix';
  var filter = null;
  var set = PUZZLES.slice();
  var at = 0;

  var state, solved, cursor, missed, selected, legalFrom;

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE) || '{}');
      return {
        solved:  raw.solved  || 0,
        attempts:raw.attempts|| 0,
        firstTry:raw.firstTry|| 0,
        streak:  raw.streak  || 0,
        best:    raw.best    || 0,
        done:    raw.done    || []
      };
    } catch (e) {
      return { solved:0, attempts:0, firstTry:0, streak:0, best:0, done:[] };
    }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(stats)); } catch (e) {}
  }

  function paintStats() {
    var acc = stats.attempts ? Math.round(stats.firstTry / stats.attempts * 100) : 0;
    setText('pzStatSolved', stats.solved);
    setText('pzStatStreak', stats.streak);
    setText('pzStatBest', stats.best);
    setText('pzStatAcc', acc + '%');
  }
  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  /* ---- board ---- */
  function buildBoard() {
    boardEl.innerHTML = '';
    for (var i = 0; i < 64; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pz-sq ' + ((fileOf(i) + rowOf(i)) % 2 ? 'is-dark' : 'is-light');
      b.dataset.i = i;
      b.setAttribute('aria-label', square(i));
      boardEl.appendChild(b);
    }
    boardEl.addEventListener('click', onSquare);
  }

  function paintBoard() {
    var cells = boardEl.children;
    for (var i = 0; i < 64; i++) {
      var p = state.board[i], cell = cells[i];
      cell.textContent = p ? GLYPH[p.toLowerCase()] : '';
      cell.className = 'pz-sq ' + ((fileOf(i) + rowOf(i)) % 2 ? 'is-dark' : 'is-light') +
        (p ? (isWhite(p) ? ' is-w' : ' is-b') : '');
      cell.setAttribute('aria-label', square(i) + (p ? ' ' + p : ' empty'));
    }
    if (selected != null) {
      cells[selected].classList.add('is-sel');
      legalFrom.forEach(function (m) {
        cells[m.to].classList.add(state.board[m.to] ? 'is-take' : 'is-move');
      });
    }
  }

  function onSquare(e) {
    var cell = e.target.closest('.pz-sq');
    if (!cell || solved) return;
    var i = +cell.dataset.i;

    if (selected != null) {
      var move = legalFrom.filter(function (m) { return m.to === i; })[0];
      if (move) { selected = null; legalFrom = []; tryMove(move); return; }
    }
    var p = state.board[i];
    if (p && (isWhite(p) ? 'w' : 'b') === state.turn) {
      selected = i;
      legalFrom = legalMoves(state, state.turn).filter(function (m) { return m.from === i; });
    } else {
      selected = null; legalFrom = [];
    }
    paintBoard();
  }

  /* ---- the puzzle loop ---- */
  function loadPuzzle(n) {
    at = (n + set.length) % set.length;
    var pz = set[at];
    state = parseFEN(pz.fen);
    solved = false; cursor = 0; missed = false; selected = null; legalFrom = [];

    turnEl.textContent = state.turn === 'w' ? 'White to play' : 'Black to play';
    turnEl.className = 'pz-turn ' + (state.turn === 'w' ? 'is-w' : 'is-b');
    themeEl.textContent = pz.theme;
    ratingEl.textContent = pz.rating;
    ideaEl.textContent = '';
    ideaEl.hidden = true;
    say('', '');
    counterEl.textContent = (at + 1) + ' / ' + set.length;
    similarEl.innerHTML = '';
    paintBoard();
  }

  function say(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'pz-status' + (kind ? ' is-' + kind : '');
  }

  function tryMove(move) {
    var pz = set[at];
    var want = pz.solution[cursor];
    var got = moveText(move);
    /* a promotion puzzle may be answered without naming the piece */
    var ok = got === want || (want.length === 5 && got === want.slice(0, 4) && move.promo === want[4]) ||
             (want.length === 5 && got.length === 4 && got === want.slice(0, 4) && want[4] === 'q');

    if (!ok) {
      if (!missed) { missed = true; stats.streak = 0; save(); paintStats(); }
      say('Not this one — look again.', 'bad');
      boardEl.classList.remove('is-wrong');
      void boardEl.offsetWidth;
      boardEl.classList.add('is-wrong');
      paintBoard();
      return;
    }

    if (want.length === 5 && !move.promo) move.promo = want[4];
    state = apply(state, move);
    cursor++;
    paintBoard();

    if (cursor >= pz.solution.length) return finish();

    /* the defence replies, then it is your move again */
    say('Good — keep going.', 'ok');
    setTimeout(function () {
      state = apply(state, parseMove(pz.solution[cursor]));
      cursor++;
      paintBoard();
      say('And now?', '');
    }, 620);
  }

  function finish() {
    solved = true;
    var pz = set[at];
    stats.attempts++;
    stats.solved++;
    if (!missed) {
      stats.firstTry++;
      stats.streak++;
      if (stats.streak > stats.best) stats.best = stats.streak;
    }
    if (stats.done.indexOf(pz.id) < 0) stats.done.push(pz.id);
    save(); paintStats();

    say(isCheckmate(state) ? 'Checkmate. Solved.' : 'Solved.', 'ok');
    ideaEl.textContent = pz.idea;
    ideaEl.hidden = false;
    showSimilar(pz);
  }

  /* the ecosystem: once a puzzle is solved, offer the same idea again */
  function showSimilar(pz) {
    var kin = PUZZLES.filter(function (o) {
      return o.id !== pz.id && (o.theme === pz.theme || o.piece === pz.piece);
    }).slice(0, 3);
    if (!kin.length) return;

    similarEl.innerHTML = '<p class="pz-kin-h">Same idea, another position</p>' +
      kin.map(function (o) {
        var done = stats.done.indexOf(o.id) >= 0;
        return '<button type="button" class="pz-kin" data-go="' + o.id + '">' +
                 '<span class="pz-kin-t">' + o.theme + '</span>' +
                 '<span class="pz-kin-m">' + o.piece + ' · ' + o.rating +
                 (done ? ' · solved' : '') + '</span>' +
               '</button>';
      }).join('');
  }

  similarEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b) return;
    var id = b.dataset.go;
    var n = set.map(function (o) { return o.id; }).indexOf(id);
    if (n < 0) { set = PUZZLES.slice(); n = set.map(function (o) { return o.id; }).indexOf(id); }
    loadPuzzle(n);
    boardEl.scrollIntoView({ behavior:'smooth', block:'center' });
  });

  /* ---- modes ---- */
  function applyMode() {
    if (mode === 'mix') set = PUZZLES.slice();
    else if (mode === 'theme')  set = filter ? PUZZLES.filter(function (p) { return p.theme === filter; }) : PUZZLES.slice();
    else if (mode === 'piece')  set = filter ? PUZZLES.filter(function (p) { return p.piece === filter; }) : PUZZLES.slice();
    else if (mode === 'rating') set = filter ? PUZZLES.filter(function (p) { return band(p.rating) === filter; }) : PUZZLES.slice();
    if (!set.length) set = PUZZLES.slice();
    loadPuzzle(0);
  }
  function band(r) { return r < 900 ? 'Up to 900' : r < 1100 ? '900–1100' : '1100+'; }

  function paintFilters() {
    var values;
    if (mode === 'theme')  values = unique(PUZZLES.map(function (p) { return p.theme; }));
    else if (mode === 'piece')  values = unique(PUZZLES.map(function (p) { return p.piece; }));
    else if (mode === 'rating') values = ['Up to 900', '900–1100', '1100+'];
    else values = [];

    filterWrap.hidden = !values.length;
    filterWrap.innerHTML = values.map(function (v) {
      return '<button type="button" class="pz-chip' + (v === filter ? ' is-on' : '') +
             '" data-filter="' + v + '">' + v + '</button>';
    }).join('');
  }
  function unique(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  modeEls.forEach(function (el) {
    el.addEventListener('click', function () {
      mode = el.dataset.mode;
      filter = null;
      modeEls.forEach(function (o) { o.classList.toggle('is-on', o === el); });
      paintFilters();
      applyMode();
    });
  });

  /* the Focus Challenge card just drives the Themes pill and scrolls down */
  var challenge = document.querySelector('.lab-go[data-mode]');
  if (challenge) {
    challenge.addEventListener('click', function () {
      var pill = modeEls.filter(function (o) { return o.dataset.mode === challenge.dataset.mode; })[0];
      if (pill) pill.click();
      filterWrap.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  }

  filterWrap.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = (filter === b.dataset.filter) ? null : b.dataset.filter;
    paintFilters();
    applyMode();
  });

  /* ---- controls ---- */
  document.getElementById('pzNext').addEventListener('click', function () { loadPuzzle(at + 1); });
  document.getElementById('pzPrev').addEventListener('click', function () { loadPuzzle(at - 1); });
  document.getElementById('pzReset').addEventListener('click', function () { loadPuzzle(at); });

  document.getElementById('pzHint').addEventListener('click', function () {
    if (solved) return;
    var m = parseMove(set[at].solution[cursor]);
    selected = m.from;
    legalFrom = legalMoves(state, state.turn).filter(function (x) { return x.from === m.from; });
    paintBoard();
    say('Start with this piece.', '');
    if (!missed) { missed = true; stats.streak = 0; save(); paintStats(); }
  });

  document.getElementById('pzSolve').addEventListener('click', function () {
    if (solved) return;
    missed = true;
    (function play() {
      if (cursor >= set[at].solution.length) { finish(); return; }
      state = apply(state, parseMove(set[at].solution[cursor]));
      cursor++;
      paintBoard();
      setTimeout(play, 560);
    })();
  });

  /* ---- go ---- */
  /* the headline count comes from the set itself, so adding a puzzle updates
     the page without anyone remembering to edit the copy */
  setText('pzTotal', PUZZLES.length);

  buildBoard();
  paintStats();
  paintFilters();
  loadPuzzle(0);

})(typeof window !== 'undefined' ? window : globalThis);
