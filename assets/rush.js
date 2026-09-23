/* Nexus Tactics Rush — "Make your progress count."

   Modules, in order down this file:
     store    local persistence (best scores, session history)
     data     batch loading, prefetch, difficulty-banded selection
     clock    deadline-based timing (never accumulates drift)
     board    rendering, drag / click / tap, promotion, input locking
     session  run rules: scoring, mistakes, advance, end
     review   post-run results, replay, retry-my-mistakes
     ui       wiring

   Chess rules come from assets/chess-core.js, which is proved correct by
   tools/perft.mjs. Puzzle answers are checked against the stored solution,
   separately from legality, exactly as the brief asks. */
(function () {
  'use strict';

  var C = window.NexusChess;
  var root = document.getElementById('rush');
  if (!C || !root) return;

  var MODES = {
    '3min':     { label: '3-Minute Rush', seconds: 180, maxMistakes: 3 },
    '5min':     { label: '5-Minute Rush', seconds: 300, maxMistakes: 3 },
    'survival': { label: 'Survival',      seconds: 0,   maxMistakes: 3 }
  };

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ANIM = reduced ? 0 : 140;          // inside the 100–180ms the brief asks for

  /* ================================================================== */
  /* store                                                              */
  /* ================================================================== */
  var store = (function () {
    var KEY = 'nexus-rush-v1';
    function read() {
      try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
      catch (e) { return {}; }
    }
    function write(d) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    }
    return {
      best: function (mode) { return (read().best || {})[mode] || 0; },
      setBest: function (mode, score) {
        var d = read();
        d.best = d.best || {};
        if (score > (d.best[mode] || 0)) { d.best[mode] = score; write(d); return true; }
        return false;
      },
      history: function () { return read().history || []; },
      addRun: function (run) {
        var d = read();
        d.history = (d.history || []);
        d.history.unshift(run);
        d.history = d.history.slice(0, 20);      // keep the last twenty runs
        write(d);
      },
      sound: function (v) {
        var d = read();
        if (v === undefined) return d.sound !== false;
        d.sound = v; write(d); return v;
      }
    };
  })();

  /* ================================================================== */
  /* data — batches stay out of the bundle and are fetched as needed     */
  /* ================================================================== */
  var data = (function () {
    var index = null;
    var loaded = {};            // file -> array
    var all = [];               // every puzzle loaded so far
    var inflight = {};

    /* force-cache was serving batches from before the set was regenerated, and
       a stalled request left the loading screen spinning with no way out. */
    function fetchJSON(url) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
      var opts = ctrl ? { signal: ctrl.signal } : {};
      return fetch(url, opts).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error(url.split('/').pop() + ' returned ' + r.status);
        return r.json();
      }).catch(function (e) {
        clearTimeout(timer);
        if (e && e.name === 'AbortError') throw new Error('Timed out loading ' + url.split('/').pop());
        throw e;
      });
    }

    function loadIndex() {
      if (index) return Promise.resolve(index);
      return fetchJSON('assets/puzzles/index.json').then(function (j) {
        index = j;
        return j;
      });
    }

    function batchList() {
      var out = [];
      if (!index) return out;
      (index.sources || []).forEach(function (s) {
        (s.batches || []).forEach(function (b) { out.push(b); });
      });
      return out.sort(function (a, b) { return a.minRating - b.minRating; });
    }

    function loadBatch(b) {
      if (loaded[b.file]) return Promise.resolve(loaded[b.file]);
      if (inflight[b.file]) return inflight[b.file];
      inflight[b.file] = fetchJSON('assets/puzzles/' + b.file).then(function (list) {
        loaded[b.file] = list;
        addAll(list);
        delete inflight[b.file];
        return list;
      }).catch(function (e) { delete inflight[b.file]; throw e; });
      return inflight[b.file];
    }

    function addAll(list) {
      var have = {};
      all.forEach(function (p) { have[p.id] = true; });
      list.forEach(function (p) { if (!have[p.id]) { have[p.id] = true; all.push(p); } });
    }

    return {
      /* The starter set is embedded, so play can begin with no network at
         all — that is what makes opening the file directly work. The index
         is then consulted for anything extra (an imported Lichess set, say),
         and a failure there is not fatal when we already have the seed. */
      prepare: function () {
        var seeded = false;
        if (Array.isArray(window.NexusPuzzleSeed) && window.NexusPuzzleSeed.length) {
          addAll(window.NexusPuzzleSeed);
          seeded = true;
        }

        /* fetch is blocked on file:// — with the seed in hand there is nothing
           to gain from asking, and it only puts an error in the console */
        if (seeded && location.protocol === 'file:') {
          return Promise.resolve(all.length);
        }

        return loadIndex().then(function () {
          var extra = [];
          (index.sources || []).forEach(function (src) {
            /* the embedded copy already covers the composed set */
            if (seeded && src.name === 'nexus-composed') return;
            (src.batches || []).forEach(function (b) { extra.push(b); });
          });
          extra.sort(function (a, b) { return a.minRating - b.minRating; });
          if (!extra.length && !seeded) throw new Error('no puzzle batches listed in index.json');
          return Promise.all(extra.slice(0, 2).map(loadBatch));
        }).catch(function (e) {
          if (seeded) return;            // the embedded set is enough to play
          throw e;
        }).then(function () { return all.length; });
      },

      /* pull the next band forward before it is needed */
      prefetchFor: function (solved) {
        if (!index) return;
        var b = batchList().filter(function (x) { return !loaded[x.file]; });
        var want = Math.min(b.length, 1 + Math.floor(solved / 6));
        for (var i = 0; i < want; i++) loadBatch(b[i]).catch(function () {});
      },

      /* so a retry after a failure is a genuinely fresh attempt */
      reset: function () { index = null; loaded = {}; all = []; inflight = {}; },

      total: function () { return all.length; },
      loadedAll: function () { return all.slice(); },

      /* How far into the run a puzzle of this length belongs. A record's
         depth is stored as mateIn; older records without it are measured
         from the solution, which is the same thing. */
      depthOf: function (p) {
        if (p.mateIn) return p.mateIn;
        return Math.ceil((p.moves.length - (p.setupPly || 0)) / 2);
      },

      /* The run is staged by how long the mate is, not by rating alone:
           1-10   mate in one   — find the finish
           11-20  mate in two   — one move, a reply, the finish
           21+    mate in three — a whole forced line
         Rating still orders the puzzles inside each stage, so it gets harder
         within a stage as well as between them. */
      stageFor: function (solved) {
        if (solved < 10) return 1;
        if (solved < 20) return 2;
        return 3;
      },

      next: function (solved, usedIds) {
        var self = this;
        var want = self.stageFor(solved);
        var fresh = all.filter(function (p) { return !usedIds[p.id]; });
        if (!fresh.length) return null;             // ran out; caller ends the run

        function atDepth(d) {
          return fresh.filter(function (p) { return self.depthOf(p) === d; });
        }

        /* the wanted stage, else the next one up, else the next one down —
           a short set must never stall the run */
        var pool = atDepth(want), onTarget = true;
        if (!pool.length) {
          onTarget = false;
          for (var d = want + 1; d <= 4 && !pool.length; d++) pool = atDepth(d);
        }
        if (!pool.length) {
          for (var e = want - 1; e >= 1 && !pool.length; e--) pool = atDepth(e);
        }
        if (!pool.length) pool = fresh;

        pool.sort(function (a, b) { return a.rating - b.rating; });

        /* Within the stage, climb by rating as the run goes on. When the set
           has run out of the depth we wanted, a shorter mate is all that is
           left — so take it from the hard end of what remains, rather than
           dropping the player back to easy puzzles late in a long run. */
        var through = onTarget ? Math.min(1, (solved % 10) / 9) : 1;
        var window = Math.max(4, Math.ceil(pool.length * (onTarget ? 0.4 : 0.25)));
        var from = Math.max(0, Math.floor((pool.length - window) * through));
        var slice = pool.slice(from, from + window);
        return slice[Math.floor(Math.random() * slice.length)];
      }
    };
  })();

  /* ================================================================== */
  /* clock — remaining time is always deadline minus now, so switching   */
  /* tabs or a stalled frame cannot bend it                             */
  /* ================================================================== */
  var clock = (function () {
    var deadline = 0, startedAt = 0, raf = 0, onTick = null, onExpire = null, running = false;

    function frame() {
      if (!running) return;
      var left = Math.max(0, deadline - Date.now());
      if (onTick) onTick(left);
      if (left <= 0) { running = false; if (onExpire) onExpire(); return; }
      raf = requestAnimationFrame(frame);
    }
    return {
      start: function (seconds, tick, expire) {
        this.stop();
        startedAt = Date.now();
        deadline = startedAt + seconds * 1000;
        onTick = tick; onExpire = expire; running = true;
        frame();
      },
      startOpen: function (tick) {              // survival: count up, no deadline
        this.stop();
        startedAt = Date.now();
        running = true;
        onTick = tick;
        (function up() {
          if (!running) return;
          if (onTick) onTick(Date.now() - startedAt);
          raf = requestAnimationFrame(up);
        })();
      },
      stop: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
      elapsed: function () { return startedAt ? Date.now() - startedAt : 0; },
      running: function () { return running; }
    };
  })();

  /* ================================================================== */
  /* sound — tiny WebAudio blips, no files to load                       */
  /* ================================================================== */
  var sound = (function () {
    var ctx = null;
    function tone(freq, ms, type, gain) {
      if (!store.sound()) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        g.gain.value = gain || 0.05;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
        o.stop(ctx.currentTime + ms / 1000);
      } catch (e) {}
    }
    return {
      move:  function () { tone(320, 60, 'triangle', 0.04); },
      right: function () { tone(660, 90, 'sine', 0.05); setTimeout(function () { tone(880, 110, 'sine', 0.05); }, 70); },
      wrong: function () { tone(180, 180, 'square', 0.04); },
      over:  function () { tone(240, 240, 'triangle', 0.05); }
    };
  })();

  /* ================================================================== */
  /* board                                                              */
  /* ================================================================== */
  var board = (function () {
    var el = document.getElementById('rushBoard');
    var cells = [];
    var st = null;                 // chess-core state
    var flipped = false;
    var locked = true;
    var selected = null;
    var legalFrom = [];
    var lastMove = null;
    var onMove = null;
    var pendingPromo = null;
    var dragging = null;

    var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

    function build() {
      el.innerHTML = '';
      cells = [];
      for (var i = 0; i < 64; i++) {
        var b = document.createElement('div');
        b.className = 'rb-sq';
        b.dataset.i = i;
        el.appendChild(b);
        cells.push(b);
      }
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onUp);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    function viewIndex(i) { return flipped ? 63 - i : i; }

    /* a8 is light, and the colours alternate, so each label takes the colour
       that contrasts with the square it sits on */
    function drawCoords() {
      var wrap = document.getElementById('rushCoords');
      if (!wrap) return;
      var ranks = wrap.querySelector('.rb-ranks');
      var files = wrap.querySelector('.rb-files');
      var r = '', f = '';
      for (var row = 0; row < 8; row++) {
        var i = viewIndex(row * 8);                       // leftmost square of this row
        var dark = ((i & 7) + (i >> 3)) % 2 === 1;
        r += '<span class="' + (dark ? 'on-dark' : 'on-light') + '">' + C.name(i)[1] + '</span>';
      }
      for (var col = 0; col < 8; col++) {
        var j = viewIndex(56 + col);                      // bottom row
        var d2 = ((j & 7) + (j >> 3)) % 2 === 1;
        f += '<span class="' + (d2 ? 'on-dark' : 'on-light') + '">' + C.name(j)[0] + '</span>';
      }
      ranks.innerHTML = r;
      files.innerHTML = f;
    }

    function paint() {
      for (var v = 0; v < 64; v++) {
        var i = viewIndex(v);
        var cell = cells[v];
        var p = st ? st.b[i] : null;
        var dark = ((i & 7) + (i >> 3)) % 2 === 1;
        var cls = 'rb-sq ' + (dark ? 'is-dark' : 'is-light');
        if (lastMove && (i === lastMove.from || i === lastMove.to)) cls += ' is-last';
        if (selected === i) cls += ' is-sel';
        if (p) cls += C.isWhite(p) ? ' is-w' : ' is-b';
        cell.className = cls;
        cell.textContent = p ? GLYPH[p.toLowerCase()] : '';
        cell.dataset.sq = C.name(i);
      }
      legalFrom.forEach(function (m) {
        var v = flipped ? 63 - m.to : m.to;
        cells[v].classList.add(st.b[m.to] ? 'rb-take' : 'rb-move');
      });
      if (st && C.inCheck(st)) {
        var k = st.kings[st.turn];
        cells[flipped ? 63 - k : k].classList.add('is-check');
      }
    }

    function squareFromEvent(e) {
      var r = el.getBoundingClientRect();
      var size = r.width / 8;
      var f = Math.floor((e.clientX - r.left) / size);
      var rr = Math.floor((e.clientY - r.top) / size);
      if (f < 0 || f > 7 || rr < 0 || rr > 7) return -1;
      return viewIndex(rr * 8 + f);
    }

    function movesFrom(i) {
      return C.legalMoves(st).filter(function (m) { return m.from === i; });
    }

    function onDown(e) {
      if (locked || pendingPromo) return;
      var i = squareFromEvent(e);
      if (i < 0) return;
      e.preventDefault();

      if (selected !== null) {
        var m = legalFrom.filter(function (x) { return x.to === i; })[0];
        if (m) { commit(m); return; }
      }
      var p = st.b[i];
      if (p && C.colorOf(p) === st.turn) {
        selected = i;
        legalFrom = movesFrom(i);
        dragging = { from: i, moved: false };
        paint();
      } else if (selected !== null) {
        selected = null; legalFrom = []; paint();
      }
    }

    function onDragMove(e) {
      if (!dragging || locked) return;
      dragging.moved = true;
      var v = flipped ? 63 - dragging.from : dragging.from;
      cells[v].classList.add('is-lifting');
    }

    function onUp(e) {
      if (!dragging || locked) { dragging = null; return; }
      var from = dragging.from, moved = dragging.moved;
      var v = flipped ? 63 - from : from;
      if (cells[v]) cells[v].classList.remove('is-lifting');
      dragging = null;
      if (!moved) return;                       // a plain click: selection stands

      var to = squareFromEvent(e);
      if (to < 0 || to === from) { paint(); return; }
      var m = legalFrom.filter(function (x) { return x.to === to; })[0];
      if (m) commit(m);
      else paint();                             // illegal: piece goes back, no penalty
    }

    function commit(m) {
      var promos = legalFrom.filter(function (x) { return x.from === m.from && x.to === m.to && x.promo; });
      if (promos.length > 1) { askPromotion(m, promos); return; }
      selected = null; legalFrom = [];
      if (onMove) onMove(m);
    }

    function askPromotion(m, promos) {
      pendingPromo = { m: m, promos: promos };
      var wrap = document.getElementById('rushPromo');
      var white = C.isWhite(st.b[m.from]);
      wrap.innerHTML = ['q', 'r', 'b', 'n'].map(function (p) {
        return '<button type="button" class="rp-btn' + (white ? ' is-w' : ' is-b') +
               '" data-promo="' + p + '" aria-label="Promote to ' +
               ({ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' })[p] + '">' + GLYPH[p] + '</button>';
      }).join('');
      wrap.hidden = false;
    }

    /* Back out of a promotion without committing to it. The picker covers the
       board, so with no way out a mis-tapped pawn would freeze a timed run. */
    function cancelPromotion() {
      if (!pendingPromo) return;
      pendingPromo = null;
      document.getElementById('rushPromo').hidden = true;
      selected = null; legalFrom = [];
      paint();                                  // the pawn goes back, no penalty
    }

    document.getElementById('rushPromo').addEventListener('click', function (e) {
      if (!pendingPromo) return;
      var b = e.target.closest('[data-promo]');
      if (!b) { cancelPromotion(); return; }    // a click on the backdrop means "never mind"
      var choice = b.dataset.promo;
      var m = pendingPromo.promos.filter(function (x) { return x.promo === choice; })[0];
      pendingPromo = null;
      this.hidden = true;
      selected = null; legalFrom = [];
      if (m && onMove) onMove(m);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') cancelPromotion();
    });

    return {
      init: function (handler) { onMove = handler; build(); },
      setPosition: function (fen, orientFor) {
        st = C.fromFEN(fen);
        flipped = orientFor === 'b';
        drawCoords();
        selected = null; legalFrom = []; lastMove = null;
        document.getElementById('rushPromo').hidden = true;
        pendingPromo = null;
        paint();
      },
      state: function () { return st; },
      apply: function (m, quiet) {
        lastMove = { from: m.from, to: m.to };
        C.make(st, m);
        selected = null; legalFrom = [];
        paint();
        if (!quiet) sound.move();
      },
      lock:   function () { locked = true; el.classList.add('is-locked'); },
      unlock: function () { locked = false; el.classList.remove('is-locked'); },
      isLocked: function () { return locked; },
      flash: function (kind) {
        el.classList.remove('is-right', 'is-wrong');
        void el.offsetWidth;
        el.classList.add(kind === 'right' ? 'is-right' : 'is-wrong');
      },
      clearFlash: function () { el.classList.remove('is-right', 'is-wrong'); },
      repaint: paint
    };
  })();

  /* ================================================================== */
  /* session — the run itself                                           */
  /* ================================================================== */
  var session = (function () {
    var mode = null, cfg = null;
    var live = false;
    var puzzle = null, solveIdx = 0, used = {}, timers = [];
    var stats = null;
    var perfSamples = [];

    function later(fn, ms) {
      var id = setTimeout(function () {
        timers = timers.filter(function (t) { return t !== id; });
        fn();
      }, ms);
      timers.push(id);
      return id;
    }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function begin(m) {
      mode = m; cfg = MODES[m];
      live = true;
      used = {};
      perfSamples = [];
      stats = {
        mode: m, solved: 0, mistakes: 0, startedAt: Date.now(),
        elapsedMs: 0, best: 0, history: []
      };
      ui.showScreen('play');
      ui.resetStageMemory();            // a fresh run starts at mate in one
      ui.paintHud(stats, cfg, cfg.seconds * 1000);
      nextPuzzle(true);
    }

    function startClockOnce() {
      if (clock.running()) return;
      if (cfg.seconds) {
        clock.start(cfg.seconds, function (left) { ui.paintClock(left, false); }, endRun.bind(null, 'time'));
      } else {
        clock.startOpen(function (up) { ui.paintClock(up, true); });
      }
    }

    function nextPuzzle(first) {
      board.clearFlash();
      var p = data.next(stats.solved, used);
      if (!p) { endRun('exhausted'); return; }
      used[p.id] = true;
      puzzle = p;
      solveIdx = p.setupPly || 0;
      /* useful when debugging, and lets the test suite drive real runs */
      document.getElementById('rushBoard').dataset.puzzle = p.id;

      board.setPosition(p.fen, solverColor(p));
      board.lock();
      ui.resetMoves();                       // a new board starts a new line

      var startPlay = function () {
        if (!live) return;
        board.unlock();
        puzzle.shownAt = performance.now();
        if (first) startClockOnce();          // clock starts only when a board is ready
      };

      if (p.setupPly) {
        /* the opponent's move into the tactic, played for the solver */
        later(function () {
          if (!live) return;
          var m = C.fromUCI(board.state(), p.moves[0]);
          if (m) play(m, true);
          later(startPlay, ANIM);
        }, first ? 260 : 380);
      } else {
        later(startPlay, first ? 60 : 180);
      }

      ui.paintPuzzleMeta(p, stats.solved);
      data.prefetchFor(stats.solved);
    }

    /* Apply a move and note it in the list. SAN has to be read from the
       position *before* the move, so this is the only place that applies
       one during play. */
    function play(m, theirs) {
      var st = board.state();
      var turn = st ? st.turn : 'w';
      var full = st && st.full ? st.full : 1;
      var san = '';
      try { san = C.toSAN(st, m); } catch (e) {}
      board.apply(m);
      ui.pushMove(san, turn, full, !!theirs);
    }

    function solverColor(p) {
      var st = C.fromFEN(p.fen);
      return (p.setupPly ? (st.turn === 'w' ? 'b' : 'w') : st.turn);
    }

    /* the answer check: stored solution first, alternate mates allowed
       where the puzzle says so */
    function isCorrect(m) {
      var want = puzzle.moves[solveIdx];
      var got = C.toUCI(m);
      if (got === want) return true;
      if (want && want.length === 4 && got.length === 5 && got.slice(0, 4) === want) return true;
      if (puzzle.altMate) {
        var st = board.state();
        C.make(st, m);
        var mate = C.isCheckmate(st);
        C.unmake(st);
        if (mate) return true;
      }
      return false;
    }

    function onPlayerMove(m) {
      if (!live || board.isLocked()) return;
      var t0 = performance.now();
      board.lock();

      var right = isCorrect(m);
      perfSamples.push(performance.now() - t0);

      play(m, false);

      if (!right) {
        board.flash('wrong');
        sound.wrong();
        stats.mistakes++;
        record('failed', m);
        ui.paintHud(stats, cfg);
        if (stats.mistakes >= cfg.maxMistakes) { later(function () { endRun('mistakes'); }, 420); return; }
        later(function () { if (live) nextPuzzle(); }, 480);
        return;
      }

      solveIdx++;
      if (solveIdx >= puzzle.moves.length) {
        board.flash('right');
        sound.right();
        stats.solved++;
        record('solved', m);
        ui.paintHud(stats, cfg);
        later(function () { if (live) nextPuzzle(); }, 320);
        return;
      }

      /* opponent replies, then the board comes back to the player */
      later(function () {
        if (!live) return;
        var reply = C.fromUCI(board.state(), puzzle.moves[solveIdx]);
        if (reply) play(reply, true);
        solveIdx++;
        later(function () { if (live) board.unlock(); }, ANIM);
      }, 220);
    }

    function record(outcome, lastMoveMade) {
      stats.history.push({
        id: puzzle.id,
        fen: puzzle.fen,
        moves: puzzle.moves.slice(),
        rating: puzzle.rating,
        themes: puzzle.themes || [],
        gameUrl: puzzle.gameUrl || null,
        source: puzzle.source,
        mateIn: data.depthOf(puzzle),
        setupPly: puzzle.setupPly || 0,
        outcome: outcome,
        playedUci: lastMoveMade ? C.toUCI(lastMoveMade) : null,
        ms: puzzle.shownAt ? Math.round(performance.now() - puzzle.shownAt) : null
      });
    }

    function endRun(why) {
      if (!live) return;
      live = false;
      clearTimers();
      clock.stop();
      board.lock();
      sound.over();

      /* anything still on the board when the clock stopped counts as unfinished */
      if (puzzle && !stats.history.some(function (h) { return h.id === puzzle.id; })) {
        stats.history.push({
          id: puzzle.id, fen: puzzle.fen, moves: puzzle.moves.slice(),
          rating: puzzle.rating, themes: puzzle.themes || [], gameUrl: puzzle.gameUrl || null,
          source: puzzle.source, mateIn: data.depthOf(puzzle),
          setupPly: puzzle.setupPly || 0,
          outcome: 'unfinished', playedUci: null, ms: null
        });
      }

      stats.elapsedMs = clock.elapsed();
      stats.reason = why;
      stats.avgMs = averageSolveMs();
      stats.topRating = topSolvedRating();
      stats.isBest = store.setBest(mode, stats.solved);
      stats.best = store.best(mode);
      stats.validationMs = perfSamples.length
        ? Math.round(perfSamples.reduce(function (a, b) { return a + b; }, 0) / perfSamples.length * 100) / 100
        : 0;
      store.addRun({
        mode: mode, solved: stats.solved, mistakes: stats.mistakes,
        elapsedMs: stats.elapsedMs, at: Date.now(), topRating: stats.topRating
      });
      review.show(stats);
    }

    function averageSolveMs() {
      var s = stats.history.filter(function (h) { return h.outcome === 'solved' && h.ms; });
      if (!s.length) return 0;
      return Math.round(s.reduce(function (a, h) { return a + h.ms; }, 0) / s.length);
    }
    function topSolvedRating() {
      var s = stats.history.filter(function (h) { return h.outcome === 'solved'; });
      return s.length ? Math.max.apply(null, s.map(function (h) { return h.rating; })) : 0;
    }

    return {
      begin: begin,
      quit: function () { if (live) endRun('quit'); },
      onPlayerMove: onPlayerMove,
      live: function () { return live; },
      abandon: function () { live = false; clearTimers(); clock.stop(); board.lock(); }
    };
  })();

  /* ================================================================== */
  /* review                                                             */
  /* ================================================================== */
  var review = (function () {
    var last = null;

    function fmt(ms) {
      var s = Math.round(ms / 1000);
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    /* the depth chip already says "M2", so mateIn2 and the bare "mate" add
       nothing to the themes column */
    function themeText(h) {
      return (h.themes || []).filter(function (t) {
        return t !== 'mate' && !/^mateIn\d$/.test(t);
      }).slice(0, 2).join(', ');
    }

    function show(stats) {
      last = stats;
      var reasonText = {
        time: 'Time!', mistakes: 'Three mistakes.', quit: 'Run ended.',
        exhausted: 'You have solved every puzzle in the set.'
      }[stats.reason] || 'Run ended.';

      document.getElementById('rsReason').textContent = reasonText;
      document.getElementById('rsScore').textContent = stats.solved;
      document.getElementById('rsBest').textContent = stats.best;
      document.getElementById('rsBestFlag').hidden = !stats.isBest;
      document.getElementById('rsMistakes').textContent = stats.mistakes;
      document.getElementById('rsTime').textContent = fmt(stats.elapsedMs);
      document.getElementById('rsAvg').textContent = stats.avgMs ? (stats.avgMs / 1000).toFixed(1) + 's' : '—';
      document.getElementById('rsTop').textContent = stats.topRating || '—';
      document.getElementById('rsValidation').textContent = stats.validationMs + 'ms';

      var wrap = document.getElementById('rsList');
      wrap.innerHTML = stats.history.map(function (h, i) {
        var mark = h.outcome === 'solved' ? '✓' : h.outcome === 'failed' ? '✗' : '—';
        return '<button type="button" class="rs-row is-' + h.outcome + '" data-i="' + i + '">' +
                 '<span class="rs-mark">' + mark + '</span>' +
                 '<span class="rs-rating">' + h.rating + '</span>' +
                 '<span class="rs-depth is-' + (h.mateIn || 1) + '">M' + (h.mateIn || 1) + '</span>' +
                 '<span class="rs-themes">' + (themeText(h) || 'tactic') + '</span>' +
                 '<span class="rs-ms">' + (h.ms ? (h.ms / 1000).toFixed(1) + 's' : '') + '</span>' +
               '</button>';
      }).join('') || '<p class="rs-empty">No puzzles attempted.</p>';

      var missed = stats.history.filter(function (h) { return h.outcome !== 'solved'; });
      document.getElementById('rsRetry').hidden = missed.length === 0;
      document.getElementById('rsRetryCount').textContent = missed.length;

      ui.showScreen('results');
    }

    /* step through a finished puzzle's solution */
    function openReplay(h) {
      var i = 0;
      var st = C.fromFEN(h.fen);
      var orient = h.setupPly ? (st.turn === 'w' ? 'b' : 'w') : st.turn;
      var panel = document.getElementById('rvPanel');
      panel.hidden = false;
      board.setPosition(h.fen, orient);
      board.lock();
      ui.showScreen('play');
      document.getElementById('rushHud').hidden = true;

      var sans = [];
      var walk = C.fromFEN(h.fen);
      h.moves.forEach(function (u) {
        var m = C.fromUCI(walk, u);
        if (!m) return;
        sans.push(C.toSAN(walk, m));
        C.make(walk, m);
      });

      document.getElementById('rvMeta').textContent =
        h.rating + ' · mate in ' + ({1:'one',2:'two',3:'three',4:'four'}[h.mateIn] || h.mateIn || '—') +
        ' · ' + (h.themes.join(', ') || 'tactic') +
        (h.outcome === 'failed' && h.playedUci ? ' · you played ' + h.playedUci : '');
      document.getElementById('rvMoves').innerHTML = sans.map(function (s, n) {
        return '<span class="rv-m" data-n="' + n + '">' + s + '</span>';
      }).join('');
      var link = document.getElementById('rvSource');
      if (h.gameUrl) { link.href = h.gameUrl; link.hidden = false; }
      else link.hidden = true;

      function step() {
        if (i >= h.moves.length) return;
        var m = C.fromUCI(board.state(), h.moves[i]);
        if (m) board.apply(m, true);
        var el = document.querySelector('.rv-m[data-n="' + i + '"]');
        if (el) {
          Array.prototype.forEach.call(document.querySelectorAll('.rv-m'), function (x) { x.classList.remove('is-on'); });
          el.classList.add('is-on');
        }
        i++;
      }
      document.getElementById('rvStep').onclick = step;
      document.getElementById('rvAll').onclick = function () {
        (function run() { if (i < h.moves.length) { step(); setTimeout(run, 420); } })();
      };
      document.getElementById('rvReset').onclick = function () {
        i = 0;
        board.setPosition(h.fen, orient);
        board.lock();
        Array.prototype.forEach.call(document.querySelectorAll('.rv-m'), function (x) { x.classList.remove('is-on'); });
      };
      document.getElementById('rvBack').onclick = function () {
        panel.hidden = true;
        document.getElementById('rushHud').hidden = false;
        show(last);
      };
    }

    document.getElementById('rsList').addEventListener('click', function (e) {
      var row = e.target.closest('[data-i]');
      if (!row || !last) return;
      openReplay(last.history[+row.dataset.i]);
    });

    return { show: show, last: function () { return last; } };
  })();

  /* ================================================================== */
  /* ui                                                                 */
  /* ================================================================== */
  var ui = (function () {
    var screens = {
      menu:    document.getElementById('rushMenu'),
      loading: document.getElementById('rushLoading'),
      error:   document.getElementById('rushError'),
      play:    document.getElementById('rushPlay'),
      results: document.getElementById('rushResults')
    };

    function showScreen(n) {
      Object.keys(screens).forEach(function (k) {
        if (screens[k]) screens[k].hidden = k !== n;
      });
      if (n === 'play') document.getElementById('rushHud').hidden = false;
    }

    function paintClock(ms, countingUp) {
      var s = Math.ceil(ms / 1000);
      var txt = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      var el = document.getElementById('rushTime');
      if (el.textContent !== txt) el.textContent = txt;      // only touch the DOM on change
      el.classList.toggle('is-low', !countingUp && ms <= 15000);
    }

    function paintHud(stats, cfg, initialMs) {
      document.getElementById('rushScore').textContent = stats.solved;
      var dots = document.getElementById('rushMistakes');
      var html = '';
      for (var i = 0; i < cfg.maxMistakes; i++) html += '<i' + (i < stats.mistakes ? ' class="is-out"' : '') + '></i>';
      dots.innerHTML = html;
      if (initialMs !== undefined) paintClock(cfg.seconds ? initialMs : 0, !cfg.seconds);
    }

    var WORD = { 1: 'one', 2: 'two', 3: 'three', 4: 'four' };
    var shownDepth = 0;
    var stepTimer = 0;

    /* The step-up is the whole point of the staging, so it gets a moment of
       its own: a line across the board the first time a longer mate appears.
       Not on the first puzzle of a run — there is nothing to step up from. */
    function announceStep(depth) {
      var el = document.getElementById('rushStep');
      if (!el) return;
      el.querySelector('b').textContent = 'Mate in ' + (WORD[depth] || depth);
      el.querySelector('span').textContent =
        depth === 2 ? 'a move, a reply, the finish' :
        depth === 3 ? 'the whole forced line now' : 'find the finish';
      el.classList.remove('is-on');
      void el.offsetWidth;
      el.classList.add('is-on');
      clearTimeout(stepTimer);
      stepTimer = setTimeout(function () { el.classList.remove('is-on'); }, 1800);
    }

    function resetStageMemory() { shownDepth = 0; }

    /* ---- the move list beside the board ---- */
    var moveRows = [];          // [{ n, white, black }]
    function resetMoves() {
      moveRows = [];
      var list = document.getElementById('rushMoves');
      var empty = document.getElementById('rushMovesEmpty');
      if (list) list.innerHTML = '';
      if (empty) empty.hidden = false;
    }
    /* The row is the real fullmove number and the column is whose turn it
       was, both read from the position. Guessing either from the order the
       moves arrive gets it wrong the moment a puzzle starts on Black. */
    function pushMove(san, turn, full, theirs) {
      if (!san) return;
      var row = null;
      for (var i = 0; i < moveRows.length; i++) if (moveRows[i].n === full) { row = moveRows[i]; break; }
      if (!row) { row = { n: full, w: null, b: null }; moveRows.push(row); }
      if (turn === 'w') row.w = { san: san, theirs: theirs };
      else row.b = { san: san, theirs: theirs };
      drawMoves();
    }
    function drawMoves() {
      var list = document.getElementById('rushMoves');
      var empty = document.getElementById('rushMovesEmpty');
      if (!list) return;
      if (empty) empty.hidden = moveRows.length > 0;
      var lastRow = moveRows.length - 1;
      list.innerHTML = moveRows.map(function (r, i) {
        function cell(m, isLast) {
          if (!m) return '<span class="mv"></span>';
          var cls = 'mv' + (m.theirs ? ' is-theirs' : '') + (isLast ? ' is-last' : '');
          return '<span class="' + cls + '">' + m.san + '</span>';
        }
        var lastIsBlack = i === lastRow && !!r.b;
        var white = r.w ? cell(r.w, i === lastRow && !r.b) : '<span class="mv is-gap">&hellip;</span>';
        return '<li><span class="n">' + r.n + '.</span>' +
               white + cell(r.b, lastIsBlack) + '</li>';
      }).join('');
      list.scrollTop = list.scrollHeight;
    }

    function paintPuzzleMeta(p, solved) {
      document.getElementById('rushRating').textContent = p.rating;
      var depth = p.mateIn || Math.ceil((p.moves.length - (p.setupPly || 0)) / 2);
      var stage = document.getElementById('rushStage');
      if (stage) {
        stage.textContent = 'Mate in ' + (WORD[depth] || depth);
        stage.className = 'rp-stage is-' + depth;
        if (shownDepth && depth > shownDepth) {
          stage.classList.add('is-stepped');
          announceStep(depth);
        }
      }
      shownDepth = depth;
      document.getElementById('rushTurn').textContent =
        (function () {
          var st = C.fromFEN(p.fen);
          var c = p.setupPly ? (st.turn === 'w' ? 'b' : 'w') : st.turn;
          return c === 'w' ? 'White to play' : 'Black to play';
        })();
    }

    return { showScreen: showScreen, paintClock: paintClock, paintHud: paintHud,
             paintPuzzleMeta: paintPuzzleMeta, resetStageMemory: resetStageMemory,
             resetMoves: resetMoves, pushMove: pushMove };
  })();

  /* ================================================================== */
  /* wiring                                                             */
  /* ================================================================== */
  board.init(session.onPlayerMove);

  var ready = false;

  function explain(e) {
    var msg = String(e && e.message || e);
    if (location.protocol === 'file:') {
      return 'The embedded puzzle set did not load. Check that ' +
             'assets/puzzles-embedded.js sits next to this page. Failing that, ' +
             'serve the folder over http — run "python -m http.server 4173" in ' +
             'the project folder and open http://127.0.0.1:4173/rush.html';
    }
    if (/returned 404/.test(msg)) {
      return msg + '. The puzzle files are missing — check that assets/puzzles/ was uploaded.';
    }
    if (/Timed out/.test(msg)) {
      return msg + '. The server did not respond. Check it is still running, then try again.';
    }
    return msg;
  }

  function ensureData() {
    if (ready) return Promise.resolve();
    ui.showScreen('loading');
    return data.prepare().then(function (n) {
      if (!n) throw new Error('The puzzle set loaded but is empty');
      ready = true;
      var count = document.getElementById('rushCount');
      if (count) count.textContent = n;
      var note = document.getElementById('rushNotice');
      if (note) note.hidden = true;
    });
  }

  function showError(e) {
    document.getElementById('rushErrorMsg').textContent = explain(e);
    ui.showScreen('error');
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-start]'), function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.dataset.start;
      ensureData().then(function () {
        session.begin(mode);
      }).catch(showError);
    });
  });

  document.getElementById('rushRetryLoad').addEventListener('click', function () {
    ready = false;
    data.reset();
    ensureData().then(function () { ui.showScreen('menu'); }).catch(showError);
  });

  document.getElementById('rushQuit').addEventListener('click', function () { session.quit(); });

  document.getElementById('rsAgain').addEventListener('click', function () {
    var m = review.last() ? review.last().mode : '3min';
    session.begin(m);
  });
  document.getElementById('rsMenu').addEventListener('click', function () {
    session.abandon();
    paintBests();
    ui.showScreen('menu');
  });

  /* retry my mistakes: replay only what went wrong, untimed */
  document.getElementById('rsRetry').addEventListener('click', function () {
    var missed = review.last().history.filter(function (h) { return h.outcome !== 'solved'; });
    if (!missed.length) return;
    practice.start(missed);
  });

  var practice = (function () {
    var list = [], at = 0, idx = 0, active = false;

    function load() {
      var h = list[at];
      idx = h.setupPly || 0;
      var st0 = C.fromFEN(h.fen);
      var orient = h.setupPly ? (st0.turn === 'w' ? 'b' : 'w') : st0.turn;
      board.setPosition(h.fen, orient);
      board.lock();
      document.getElementById('rushRating').textContent = h.rating;
      document.getElementById('rushTurn').textContent = 'Practice · ' + (at + 1) + ' of ' + list.length;
      setTimeout(function () {
        if (!active) return;
        if (h.setupPly) {
          var m = C.fromUCI(board.state(), h.moves[0]);
          if (m) board.apply(m);
        }
        board.unlock();
      }, 240);
    }

    function onMove(m) {
      var h = list[at];
      var want = h.moves[idx];
      if (C.toUCI(m) !== want && !(want.length === 4 && C.toUCI(m).slice(0, 4) === want)) {
        board.flash('wrong'); sound.wrong();
        return;                                  // untimed: try again, no penalty
      }
      board.apply(m);
      idx++;
      if (idx >= h.moves.length) {
        board.flash('right'); sound.right();
        board.lock();
        setTimeout(function () {
          if (!active) return;
          at++;
          if (at >= list.length) { stop(); review.show(review.last()); return; }
          load();
        }, 520);
        return;
      }
      board.lock();
      setTimeout(function () {
        if (!active) return;
        var reply = C.fromUCI(board.state(), h.moves[idx]);
        if (reply) board.apply(reply);
        idx++;
        board.unlock();
      }, 260);
    }

    function stop() { active = false; board.init(session.onPlayerMove); }

    return {
      start: function (missed) {
        list = missed; at = 0; active = true;
        board.init(onMove);
        document.getElementById('rushHud').hidden = false;
        document.getElementById('rushTime').textContent = '—';
        ui.showScreen('play');
        load();
      }
    };
  })();

  function paintBests() {
    Object.keys(MODES).forEach(function (m) {
      var el = document.querySelector('[data-best="' + m + '"]');
      if (el) el.textContent = store.best(m);
    });
    var h = store.history();
    var wrap = document.getElementById('rushHistory');
    if (!wrap) return;
    if (!h.length) { wrap.innerHTML = '<p class="rh-empty">No runs yet. Your last twenty will appear here.</p>'; return; }
    wrap.innerHTML = h.slice(0, 6).map(function (r) {
      var d = new Date(r.at);
      return '<div class="rh-row"><b>' + r.solved + '</b>' +
             '<span>' + MODES[r.mode].label + '</span>' +
             '<span>' + r.mistakes + ' missed</span>' +
             '<span>' + d.toLocaleDateString() + '</span></div>';
    }).join('');
  }

  var soundBtn = document.getElementById('rushSound');
  function paintSound() { soundBtn.textContent = store.sound() ? 'Sound on' : 'Sound off'; soundBtn.setAttribute('aria-pressed', String(store.sound())); }
  soundBtn.addEventListener('click', function () { store.sound(!store.sound()); paintSound(); });

  paintBests();
  paintSound();
  ui.showScreen('menu');

  /* warm the data up in the background so the first run starts instantly */
  data.prepare().then(function (n) {
    ready = true;
    var count = document.getElementById('rushCount');
    if (count) count.textContent = n;
  }).catch(function (e) {
    /* leave the menu up, but say what is wrong rather than failing silently.
       This goes in its own element: writing into .rk-note would destroy the
       #rushCount span inside it and break the retry that follows. */
    var note = document.getElementById('rushNotice');
    if (note) { note.textContent = 'Puzzles did not load. ' + explain(e); note.hidden = false; }
    data.reset();
  });

})();
