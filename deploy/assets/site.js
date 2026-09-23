/* Nexus Chess Academy — shared behaviour for every page.
   Each block checks for its own section first, so a page that does not
   contain that section simply skips it. */

/* ---------- shared data ---------- */
  /* Each coach's photographs, in the order their folder lists them. The card
     opens on the first entry and cycles down the list. A numeric prefix on the
     filename sets the order — this block is generated from the folder. */
  /* Every coach follows the same rule: the folder's second photograph shows
     last, the rest move up a place. */
  const PHOTOS = {
    coach1: [
      { src:'assets/coaches/coach-1/certificate.jpg', cap:'Certificate — U.S. Consulate General Karachi' },
      { src:'assets/coaches/coach-1/stage.jpg', cap:'Award ceremony, Arts Council of Pakistan' },
      { src:'assets/coaches/coach-1/teaching.jpg', cap:'Coaching a session at the academy' },
      { src:'assets/coaches/coach-1/portrait.jpg', cap:'Coach studying a position at the board' }
    ],
    coach2: [
      { src:'assets/coaches/coach-2/award.jpg', cap:'District South Sports Tournament 2025' },
      { src:'assets/coaches/coach-2/classroom.jpg', cap:'Teaching tournament rules at the academy' },
      { src:'assets/coaches/coach-2/portrait.jpg', cap:'Coach playing a rated game at a tournament' },
      { src:'assets/coaches/coach-2/room.jpg', cap:'Rules session at the academy' },
      { src:'assets/coaches/coach-2/cheque.jpg', cap:'Winner — Denning Institute open' }
    ],
    coach3: [
      { src:'assets/coaches/coach-3/1-portrait.jpg', cap:'Coach with the Sindh Games 2024 trophy' },
      { src:'assets/coaches/coach-3/3-cheque.jpg', cap:'All Pakistan Intervarsity 2024 — 2nd position' },
      { src:'assets/coaches/coach-3/4-varsity.jpg', cap:'8th All Pakistan Intervarsity, May 2024' },
      { src:'assets/coaches/coach-3/5-karachi.jpg', cap:'Karachi Games 2023 — team trophy' },
      { src:'assets/coaches/coach-3/2-trophy.jpg', cap:'Sindh Games 2024 — Chess' }
    ]
  };
  const COACHES = [
    {
      name:'Shehroz',
      role:'Founder & Head Coach',
      rating:'2100', ratingLabel:'Lichess rating',
      style:'Attacking — takes the chance the moment it appears.',
      photos: PHOTOS.coach1,
      achievements:[]
    },
    {
      name:'Tayyab Ali',
      role:'Coach · Tournament Preparation',
      rating:'2400', ratingLabel:'Lichess rating',
      style:'Positional — builds an edge and grinds it out.',
      photos: PHOTOS.coach2,
      /* only results a photograph on this page documents */
      achievements:[
        'District South Sports Tournament 2025',
        'Denning Institute open — winner'
      ]
    },
    {
      name:'M. Mustafa Adil',
      role:'Coach · Youth Program',
      rating:'2200', ratingLabel:'Lichess rating',
      style:'Balanced, with a positionally aggressive streak.',
      photos: PHOTOS.coach3,
      achievements:[
        'Sindh Games 2024 — Chess',
        'All Pakistan Intervarsity 2024 — 2nd position',
        'Karachi Games 2023 — team trophy'
      ]
    }
  ];


/* ---------- hero: board + particle canvas ---------- */
(function(){
  if(!document.getElementById('hero')) return;
  const board = document.getElementById('board');
  const glowSet = new Set(['2-4','3-3','5-2','6-5']);
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq = document.createElement('div');
      const isDark = (r+c)%2===0;
      sq.className = 'sq ' + (isDark ? 'dark' : 'light');
      if(glowSet.has(r+'-'+c)) sq.classList.add('glow');
      board.appendChild(sq);
    }
  }

  const rig = document.getElementById('boardRig');
  const hero = document.getElementById('hero');
  const baseRotX = 52, baseRotZ = 38;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // camera-settle entrance: board starts flat, eases into its final tilt once
  if(!reduceMotion){
    rig.style.transition = 'none';
    rig.style.transform = 'rotateX(0deg) rotateZ(0deg)';
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        rig.style.transition = 'transform 0.9s cubic-bezier(0.16,1,0.3,1)';
        rig.style.transform = `rotateX(${baseRotX}deg) rotateZ(${baseRotZ}deg)`;
        rig.addEventListener('transitionend', function onSettle(){
          rig.style.transition = 'transform 0.15s ease-out';
          rig.removeEventListener('transitionend', onSettle);
        });
      });
    });
  }

  if(window.matchMedia('(min-width:901px)').matches){
    hero.addEventListener('mousemove', (e)=>{
      const rect = hero.getBoundingClientRect();
      const px = (e.clientX - rect.left)/rect.width - 0.5;
      const py = (e.clientY - rect.top)/rect.height - 0.5;
      rig.style.transform = `rotateX(${baseRotX - py*8}deg) rotateZ(${baseRotZ + px*10}deg)`;
    });
    hero.addEventListener('mouseleave', ()=>{
      rig.style.transform = `rotateX(${baseRotX}deg) rotateZ(${baseRotZ}deg)`;
    });
  }

  // pause board/particle motion when the hero is off screen
  let heroVisible = true;
  const heroObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      heroVisible = entry.isIntersecting;
      hero.classList.toggle('is-offscreen', !heroVisible);
    });
  }, { threshold: 0.05 });
  heroObserver.observe(hero);

  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let w,h,nodes;
  function resize(){ w = canvas.width = hero.offsetWidth; h = canvas.height = hero.offsetHeight; }
  function initNodes(){
    nodes = Array.from({length: Math.min(60, Math.floor(w/24))}, ()=>({
      x: Math.random()*w, y: Math.random()*h,
      vx: (Math.random()-0.5)*0.15, vy: (Math.random()-0.5)*0.15,
      r: Math.random()*1.4+0.4
    }));
  }
  function tick(){
    ctx.clearRect(0,0,w,h);
    for(const n of nodes){
      n.x += n.vx; n.y += n.vy;
      if(n.x<0||n.x>w) n.vx*=-1;
      if(n.y<0||n.y>h) n.vy*=-1;
    }
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i], b=nodes[j];
        const d = Math.hypot(a.x-b.x, a.y-b.y);
        if(d<120){
          ctx.strokeStyle = `rgba(79,216,255,${0.12*(1-d/120)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    for(const n of nodes){
      ctx.fillStyle = 'rgba(199,208,224,0.5)';
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2); ctx.fill();
    }
    if(heroVisible) requestAnimationFrame(tick);
  }
  window.addEventListener('resize', ()=>{ resize(); initNodes(); });
  resize(); initNodes(); tick();

  // resume the canvas loop when the hero re-enters view
  const canvasObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) requestAnimationFrame(tick);
    });
  }, { threshold: 0.05 });
  canvasObserver.observe(hero);
})();

/* ---------- lesson drawer: Escape to close ---------- */
  /* ---- Escape closes the lesson drawer ---- */
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape'){
      const ld = document.getElementById('lessonDrawer');
      const ls = document.getElementById('lessonScrim');
      if(ld) ld.classList.remove('is-open');
      if(ls) ls.classList.remove('is-open');
    }
  });

  /* ================= MEET THE COACHES =================
     ⚠ ALL COACH CONTENT BELOW IS PLACEHOLDER.
     Replace every name, rating, achievement, quote and record with real,
     verified details before publishing. Each coach gets its own full
     section, generated from this array — add a fourth object and a
     fourth chapter appears, alternating sides automatically.
  ==================================================== */

/* ---------- the nexus method ---------- */
  /* ================= THE NEXUS METHOD ================= */
  (function(){
    const methodSection = document.getElementById('how-it-works');
    if(!methodSection) return;

    /* Booking destination: overridable without touching this script.
       Set data-booking-href on the section when a real flow exists. */
    const bookBtn = document.getElementById('methodBookBtn');
    const bookHref = methodSection.dataset.bookingHref;
    if(bookBtn && bookHref) bookBtn.setAttribute('href', bookHref);

    const journey    = document.getElementById('journey');
    const milestones = methodSection.querySelectorAll('.milestone');
    const methodHead = document.getElementById('methodHead');
    const still      = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if(still){
      /* static presentation — everything is already visible via the CSS */
      if(methodHead) methodHead.classList.add('is-in');
      if(journey) journey.classList.add('is-in');
      milestones.forEach(m => m.classList.add('is-in'));
      return;
    }

    /* the header plays itself: rule, eyebrow, the two headline lines rising
       out from behind their masks, the gold sweep, then the lede. The whole
       sequence is described in the CSS — this only says when to start it. */
    if(methodHead){
      const headObserver = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{
          if(!e.isIntersecting) return;
          e.target.classList.add('is-in');
          headObserver.unobserve(e.target);
        });
      }, { threshold:0.25 });
      headObserver.observe(methodHead);
    }

    /* the journey line draws once, then the panels stagger in behind it */
    const journeyObserver = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(!e.isIntersecting) return;
        e.target.classList.add('is-in');
        milestones.forEach((m,i)=> setTimeout(()=> m.classList.add('is-in'), 180 + i * 110));
        journeyObserver.unobserve(e.target);
      });
    }, { threshold:0.2 });
    if(journey) journeyObserver.observe(journey);
  })();

/* ---------- meet the coaches ----------
   One card per entry in COACHES. Inside each card the coach's photographs
   rotate on a dwell; the rotation pauses while the pointer or focus is on
   that card, and stops entirely off-screen or under reduced motion. The
   card opens a profile dialog that can be paged through without closing. */
(function(){
  const grid = document.getElementById('rsGrid');
  if(!grid) return;

  const dialog  = document.getElementById('rsDialog');
  const still   = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DWELL   = 3200;                       // how long each photograph holds

  /* only what was actually supplied about each coach — no invented
     specialities, biographies or quotes */
  const roster = COACHES.map(c => ({
    name: c.name,
    role: c.role,
    rating: c.rating, ratingLabel: c.ratingLabel,
    style: c.style,
    achievements: c.achievements || [],
    photos: (c.photos || []).map(ph => ({ src: ph.src, cap: ph.cap }))
  })).filter(c => c.photos.length);

  const total = roster.length;
  const countEl = document.getElementById('rsCount');
  if(countEl) countEl.textContent = String(total).padStart(2, '0');

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---- build ---- */
  grid.innerHTML = roster.map(function(c, i){
    const shots = c.photos.map(function(p, k){
      /* the first photograph of the first card is what the visitor sees first,
         so it is the only one worth fetching eagerly */
      const eager = (i === 0 && k === 0);
      return '<img src="' + esc(p.src) + '" alt="' + (k === 0 ? esc(c.name) + ' — ' + esc(p.cap) : '') + '"' +
             (k === 0 ? '' : ' aria-hidden="true"') +
             ' width="540" height="700" decoding="async" loading="' + (eager ? 'eager' : 'lazy') + '"' +
             (k === 0 ? ' class="is-live"' : '') + '>';
    }).join('');

    const ticks = c.photos.map(function(_, k){
      return '<i' + (k === 0 ? ' class="is-live"' : '') + '></i>';
    }).join('');

    return '' +
      '<article class="rs-card" data-coach="' + i + '">' +
        '<div class="rs-visual">' +
          '<div class="rs-art">' + shots + '</div>' +
          '<div class="rs-top">' +
            '<span>Nexus coaching</span>' +
            '<span class="rs-num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '</div>' +
          '<div class="rs-ticks" aria-hidden="true">' + ticks + '</div>' +
          '<div class="rs-bottom">' +
            '<div>' +
              '<p class="rs-role">' + esc(c.role) + '</p>' +
              '<p class="rs-name">' + esc(c.name) + '</p>' +
            '</div>' +
            '<button type="button" class="rs-open" data-open="' + i + '" ' +
                    'aria-label="Open the profile of ' + esc(c.name) + '">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="rs-cap">' +
          '<span class="rs-cap-text" data-cap="' + i + '">' + esc(c.photos[0].cap) + '</span>' +
          '<button type="button" class="rs-link" data-open="' + i + '">Full profile <span aria-hidden="true">↗</span></button>' +
        '</div>' +
      '</article>';
  }).join('');

  const cards = Array.prototype.slice.call(grid.querySelectorAll('.rs-card'));

  /* ---- the photographs rotate inside each card ---- */
  const at    = new Array(total).fill(0);
  const timer = new Array(total).fill(null);
  let onScreen = false;

  function showPhoto(i, k){
    const card = cards[i];
    const imgs = card.querySelectorAll('.rs-art img');
    const tick = card.querySelectorAll('.rs-ticks i');
    if(!imgs.length) return;
    at[i] = ((k % imgs.length) + imgs.length) % imgs.length;
    imgs.forEach(function(img, n){
      const live = n === at[i];
      img.classList.toggle('is-live', live);
      /* only the visible photograph is described; the rest are decoration */
      if(live){ img.removeAttribute('aria-hidden'); img.alt = roster[i].name + ' — ' + roster[i].photos[n].cap; }
      else { img.setAttribute('aria-hidden', 'true'); img.alt = ''; }
    });
    tick.forEach(function(t, n){ t.classList.toggle('is-live', n === at[i]); });
    const cap = card.querySelector('[data-cap]');
    if(cap) cap.textContent = roster[i].photos[at[i]].cap;
  }

  function stop(i){ clearTimeout(timer[i]); timer[i] = null; }
  function stopAll(){ for(let i = 0; i < total; i++) stop(i); }

  function run(i){
    stop(i);
    if(still || !onScreen || roster[i].photos.length < 2) return;
    if(cards[i].dataset.held === '1') return;
    timer[i] = setTimeout(function(){ showPhoto(i, at[i] + 1); run(i); }, DWELL);
  }
  function runAll(){ for(let i = 0; i < total; i++) run(i); }

  cards.forEach(function(card, i){
    /* resting on a card holds its photograph, so it can be looked at */
    card.addEventListener('pointerenter', function(){ card.dataset.held = '1'; stop(i); });
    card.addEventListener('pointerleave', function(){ card.dataset.held = '0'; run(i); });
    card.addEventListener('focusin',  function(){ card.dataset.held = '1'; stop(i); });
    card.addEventListener('focusout', function(e){
      if(card.contains(e.relatedTarget)) return;
      card.dataset.held = '0'; run(i);
    });
  });

  const section = document.getElementById('coaches');
  new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){ section.classList.add('is-in'); onScreen = true; runAll(); }
      else { onScreen = false; stopAll(); }
    });
  }, { threshold: 0.12 }).observe(section);

  /* ---- the profile ---- */
  if(!dialog) return;

  const dVisual = document.getElementById('rsDialogVisual');
  const dCap    = document.getElementById('rsDialogCap');
  const dRole   = document.getElementById('rsDialogRole');
  const dName   = document.getElementById('rsDialogName');
  const dBio    = document.getElementById('rsDialogBio');
  const dFacts  = document.getElementById('rsDialogFacts');
  const dCount  = document.getElementById('rsDialogCount');

  let open = 0;
  let shot = 0;
  let shotTimer = null;
  let opener = null;

  function fact(term, detail){
    return '<div><dt>' + esc(term) + '</dt><dd>' + esc(detail) + '</dd></div>';
  }

  function paintShot(){
    const imgs = dVisual.querySelectorAll('img');
    if(!imgs.length) return;
    shot = ((shot % imgs.length) + imgs.length) % imgs.length;
    imgs.forEach(function(img, n){ img.classList.toggle('is-live', n === shot); });
    dCap.textContent = roster[open].photos[shot].cap;
  }

  function cycleShots(){
    clearTimeout(shotTimer);
    if(still || roster[open].photos.length < 2) return;
    shotTimer = setTimeout(function(){ shot += 1; paintShot(); cycleShots(); }, DWELL + 600);
  }

  function paint(i){
    open = ((i % total) + total) % total;
    const c = roster[open];

    dVisual.querySelectorAll('img').forEach(function(n){ n.remove(); });
    c.photos.forEach(function(p, k){
      const img = document.createElement('img');
      img.src = p.src;
      img.alt = k === 0 ? c.name + ' — ' + p.cap : '';
      if(k !== 0) img.setAttribute('aria-hidden', 'true');
      img.loading = 'lazy';
      img.decoding = 'async';
      dVisual.insertBefore(img, dCap);
    });
    shot = 0;
    paintShot();
    cycleShots();

    dRole.textContent = c.role;
    dName.textContent = c.name;
    /* nothing is invented here: a coach with no line written for them simply
       does not get that row */
    dBio.textContent = c.style || '';
    dBio.hidden = !c.style;

    let html = '';
    if(c.rating) html += fact(c.ratingLabel || 'Rating', c.rating);
    if(c.achievements.length) html += fact('Achievements', c.achievements.join(String.fromCharCode(10)));
    dFacts.innerHTML = html;

    dCount.textContent = String(open + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
  }

  function openProfile(i, from){
    opener = from || null;
    paint(i);
    if(typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    stopAll();                                  // the cards hold while the profile is up
  }

  function closeProfile(){
    clearTimeout(shotTimer);
    if(dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  grid.addEventListener('click', function(e){
    const b = e.target.closest('[data-open]');
    if(!b) return;
    openProfile(+b.dataset.open, b);
  });

  document.getElementById('rsClose').addEventListener('click', closeProfile);
  document.getElementById('rsPrev').addEventListener('click', function(){ paint(open - 1); });
  document.getElementById('rsNext').addEventListener('click', function(){ paint(open + 1); });

  /* a click on the backdrop closes it, a click on the card inside does not */
  dialog.addEventListener('click', function(e){
    if(e.target === dialog) closeProfile();
  });

  dialog.addEventListener('keydown', function(e){
    if(e.key === 'ArrowLeft')  { e.preventDefault(); paint(open - 1); }
    if(e.key === 'ArrowRight') { e.preventDefault(); paint(open + 1); }
  });

  dialog.addEventListener('close', function(){
    clearTimeout(shotTimer);
    if(onScreen) runAll();
    if(opener && document.contains(opener)) opener.focus();
    opener = null;
  });
})();

/* ---------- honours ---------- */
(function(){
  if(!document.getElementById('honList')) return;
  /* ================= HONOURS ================= */
  /* honImg src is set in the markup so it loads during HTML parse, not after JS runs */

  const HONOURS = [
    { year:'2024', name:'Sindh Games \u2014 Chess (Men & Women)', sub:'Provincial games, Sindh', place:'1st position' },
    { year:'2024', name:'8th All Pakistan Intervarsity Chess Championship', sub:'HEC \u00b7 Rawalpindi Women University, May 8\u201311', place:'1st position' },
    { year:'2023\u201324', name:'All Pakistan Intervarsity Chess Championship', sub:'Prize presentation, January', place:'2nd position' },
    { year:'2023', name:'Karachi Games \u2014 Chess', sub:'Team trophy presentation', place:'1st position' },
    { year:'2025', name:'District South Sports Tournament', sub:'Youth Development Centre South, Karachi', place:'1st position' }
  ];

  const honList = document.getElementById('honList');
  honList.innerHTML = HONOURS.map(h => `
    <div class="hon-row">
      <span class="hon-year">${h.year}</span>
      <span class="hon-name">${h.name}<span class="hon-sub">${h.sub}</span></span>
      <span class="hon-place">${h.place}</span>
    </div>`).join('');

  const honReveal = new IntersectionObserver((entries)=>{
    entries.forEach((e, i)=>{
      if(e.isIntersecting){
        setTimeout(()=> e.target.classList.add('is-in'), i * 90);
        honReveal.unobserve(e.target);
      }
    });
  }, { threshold:0.2 });
  honList.querySelectorAll('.hon-row').forEach(el => honReveal.observe(el));

})();

/* ---------- learning path ---------- */
(function(){
  if(!document.getElementById('pathCanvas')) return;
  const ICONS = {
    board:'<path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    pawn:'<circle cx="12" cy="7" r="3"/><path d="M12 10c-3 3-3 6-2 8h4c1-2 1-5-2-8z"/><path d="M7 21h10"/>',
    rook:'<path d="M6 4h12v3l-2 2v8l2 4H6l2-4V9L6 7z"/><path d="M10 4v2M14 4v2"/>',
    crown:'<path d="M4 8l3 9h10l3-9-4.5 3L12 5 8.5 11z"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    swap:'<path d="M4 8h11l-3-3M20 16H9l3 3"/>',
    shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    bolt:'<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    flag:'<path d="M6 3v18M6 4h11l-2 4 2 4H6"/>',
    eye:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
    layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    grad:'<path d="M12 4L2 9l10 5 10-5z"/><path d="M6 12v4c0 1.5 3 3 6 3s6-1.5 6-3v-4"/>'
  };
  const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const lessonIcon = k => `<svg class="node-icon" ${ICON_ATTRS}>${ICONS[k]||ICONS.board}</svg>`;

  const DECO = {
    pawn:'<svg viewBox="0 0 64 92"><circle cx="32" cy="24" r="11" fill="#e8eef7" opacity="0.85"/><path d="M32 36c-8 8-11 20-8 30h16c3-10 0-22-8-30z" fill="#dbe4f0" opacity="0.85"/><rect x="18" y="66" width="28" height="8" rx="2" fill="#cbd6e6" opacity="0.85"/></svg>',
    knight:'<svg viewBox="0 0 64 92"><path d="M42 8C30 5 15 12 10 26c-3 9 2 15 0 22-2 6-8 8-7 15 1 7 10 8 17 5l2 6h28c1-17 4-36-3-50-2-7-1-13-5-16z" fill="#e2eaf5" opacity="0.85"/><rect x="10" y="74" width="44" height="8" rx="2" fill="#cbd6e6" opacity="0.85"/></svg>',
    rook:'<svg viewBox="0 0 64 92"><path d="M14 8h36v10l-6 6v34H20V24l-6-6z" fill="#e2eaf5" opacity="0.85"/><rect x="12" y="58" width="40" height="9" rx="2" fill="#cbd6e6" opacity="0.85"/></svg>',
    queen:'<svg viewBox="0 0 64 92"><path d="M12 16l6 20h28l6-20-9 8-11-14-11 14z" fill="#e8eef7" opacity="0.85"/><path d="M18 38c-2 10-1 18 2 24h24c3-6 4-14 2-24z" fill="#dbe4f0" opacity="0.85"/><rect x="14" y="62" width="36" height="9" rx="2" fill="#cbd6e6" opacity="0.85"/></svg>'
  };

  const SECTIONS = [
    { name:'Learn the Board', eyebrow:'Stage 00', blurb:'The geometry before the game.', accent:'#4fd8ff',
      lessons:[
        {t:'The board and its language', i:'board', d:'How files, ranks and squares are named \u2014 and why notation is the first tool, not the last.', m:'8 min'},
        {t:'How each piece moves', i:'pawn', d:'Movement rules for all six pieces, with the constraints that make each one useful.', m:'12 min'},
        {t:'Capturing and check', i:'target', d:'What it means to attack a square, and why check is a constraint rather than a threat.', m:'10 min'},
        {t:'Castling and en passant', i:'swap', d:'The two special moves, and the positions where each one genuinely matters.', m:'9 min'},
        {t:'Checkmate and stalemate', i:'crown', d:'The difference between a won game and a drawn one, drilled on simple positions.', m:'11 min'},
        {t:'Stage assessment', i:'grad', d:'A short assessment confirming board fluency before you move to Foundations.', m:'15 min'}
      ]},
    { name:'Foundations', eyebrow:'Stage 01', blurb:'Rated 800 \u2013 1400.', accent:'#c9a66b',
      lessons:[
        {t:'Controlling the centre', i:'target', d:'Why central squares are worth more, and how to contest them from move one.', m:'14 min'},
        {t:'Developing with purpose', i:'layers', d:'Getting pieces out is not the goal \u2014 getting them onto squares that do work is.', m:'13 min'},
        {t:'King safety', i:'shield', d:'When to castle, when to delay, and how to read an exposed king.', m:'12 min'},
        {t:'Basic tactical patterns', i:'bolt', d:'Forks, pins and skewers as recurring shapes rather than isolated tricks.', m:'18 min'},
        {t:'Trading pieces well', i:'swap', d:'Every exchange changes the position\u2019s character \u2014 learn to choose which change you want.', m:'15 min'},
        {t:'Basic endgames', i:'flag', d:'King and pawn endings: the foundation every other endgame is measured against.', m:'20 min'},
        {t:'Stage assessment', i:'grad', d:'Rated assessment game with written review from your coach.', m:'45 min'}
      ]},
    { name:'Competitive', eyebrow:'Stage 02', blurb:'Rated 1400 \u2013 2000.', accent:'#d08a52',
      lessons:[
        {t:'Building a repertoire', i:'layers', d:'Choosing openings that match how you actually like to play, then narrowing them.', m:'22 min'},
        {t:'Pawn structures', i:'board', d:'The handful of structures that decide most middlegames, and the plans each one implies.', m:'25 min'},
        {t:'Calculation under pressure', i:'clock', d:'Structured calculation: candidate moves, forcing lines, and knowing when to stop.', m:'28 min'},
        {t:'Prophylactic thinking', i:'eye', d:'Reading your opponent\u2019s plan before it arrives, and the moves that quietly stop it.', m:'24 min'},
        {t:'Converting advantages', i:'crown', d:'Why won positions get drawn, and the technique that prevents it.', m:'26 min'},
        {t:'Rook endgames', i:'rook', d:'The most common endgame in practice, and the positions worth knowing exactly.', m:'30 min'},
        {t:'Stage assessment', i:'grad', d:'Two rated games plus a full engine-assisted review session.', m:'90 min'}
      ]},
    { name:'Advanced', eyebrow:'Stage 03', blurb:'Rated 2000+.', accent:'#8b7fe8',
      lessons:[
        {t:'Deep opening preparation', i:'search', d:'Preparing lines against a specific opponent, not a general audience.', m:'35 min'},
        {t:'Dynamic vs static advantage', i:'bolt', d:'When to play for a lasting edge and when a temporary one has to be cashed immediately.', m:'32 min'},
        {t:'Sacrificial attack', i:'crown', d:'Evaluating material sacrifices by compensation rather than by count.', m:'34 min'},
        {t:'Complex endgame technique', i:'flag', d:'Multi-piece endings where general principles stop being enough.', m:'38 min'},
        {t:'Time management', i:'clock', d:'Allocating clock time across a game\u2019s phases, and recovering from time trouble.', m:'26 min'},
        {t:'Stage assessment', i:'grad', d:'Classical game against a resident coach with full post-game analysis.', m:'2 hrs'}
      ]},
    { name:'Grandmaster Path', eyebrow:'Stage 04', blurb:'By invitation.', accent:'#dfe6f2',
      lessons:[
        {t:'Opponent-specific preparation', i:'search', d:'Building a game plan from an opponent\u2019s full database history.', m:'1 hr'},
        {t:'Tournament seconding', i:'shield', d:'Working with a second: what to prepare, what to delegate, what to ignore.', m:'1 hr'},
        {t:'Norm campaign planning', i:'flag', d:'Selecting events, pacing a campaign, and managing form across a season.', m:'45 min'},
        {t:'Engine-assisted deep analysis', i:'eye', d:'Using evaluation as an argument to interrogate, not a verdict to accept.', m:'1 hr'}
      ]}
  ];

  const COMPLETED = 9;
  const pathCanvas = document.getElementById('pathCanvas');
  const COLS = [1, 2, 3, 2, 1, 2, 3];
  const DECO_COLS = { 1:3, 3:1, 5:4 };
  const DECO_KEYS = ['knight','pawn','rook','queen'];

  let lessonIndex = 0;
  const pathNodes = [];

  SECTIONS.forEach((sec, si)=>{
    const head = document.createElement('div');
    head.className = 'sec-head';
    head.innerHTML = `
      <div class="sec-eyebrow">${sec.eyebrow}</div>
      <h3 style="color:${sec.accent}">${sec.name}</h3>
      <p>${sec.blurb}</p>
      <div class="sec-rule"></div>`;
    pathCanvas.appendChild(head);

    const lattice = document.createElement('div');
    lattice.className = 'lattice';
    lattice.style.setProperty('--accent', sec.accent);

    sec.lessons.forEach((les, li)=>{
      const state = lessonIndex < COMPLETED ? 'done' : (lessonIndex === COMPLETED ? 'current' : 'locked');
      const col = COLS[li % COLS.length];

      if(li > 0){
        const linkRow = document.createElement('div');
        linkRow.className = 'node-row';
        const link = document.createElement('div');
        link.className = 'link' + (lessonIndex <= COMPLETED ? ' filled' : '');
        link.style.gridColumn = Math.round((col + COLS[(li-1) % COLS.length]) / 2) + 1;
        linkRow.appendChild(link);
        lattice.appendChild(linkRow);
      }

      const row = document.createElement('div');
      row.className = 'node-row';

      const node = document.createElement('div');
      node.className = `node ${state}`;
      node.style.gridColumn = col + 1;
      node.dataset.section = si;
      node.dataset.lesson = li;
      node.innerHTML = `<div class="node-face"></div>${lessonIcon(les.i)}` +
        (state === 'current' ? '<div class="node-flag">Next</div>' : '');
      row.appendChild(node);
      pathNodes.push(node);

      if(DECO_COLS[li] !== undefined){
        const d = document.createElement('div');
        d.className = 'deco';
        d.style.gridColumn = DECO_COLS[li] + 1;
        d.innerHTML = DECO[DECO_KEYS[(si + li) % DECO_KEYS.length]];
        row.appendChild(d);
      }

      lattice.appendChild(row);
      lessonIndex++;
    });

    pathCanvas.appendChild(lattice);
  });

  const TOTAL_LESSONS = SECTIONS.reduce((n,s)=> n + s.lessons.length, 0);
  const pctValue = Math.round((COMPLETED / TOTAL_LESSONS) * 100);

  const pathReveal = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('is-in'); pathReveal.unobserve(e.target); } });
  }, { threshold:0.2, rootMargin:'0px 0px -60px 0px' });
  document.querySelectorAll('.node, .sec-head').forEach(el=> pathReveal.observe(el));

  // fill the progress bar only once the path section is reached
  const progressObserver = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        document.getElementById('progressFill').style.width = pctValue + '%';
        document.getElementById('pctLabel').textContent = pctValue + '%';
        progressObserver.disconnect();
      }
    });
  }, { threshold:0.4 });
  progressObserver.observe(document.querySelector('.path-progress'));

  const lessonDrawer = document.getElementById('lessonDrawer');
  const lessonScrim = document.getElementById('lessonScrim');
  const lessonBody = document.getElementById('lessonBody');

  function openLesson(si, li){
    const sec = SECTIONS[si], les = sec.lessons[li];
    let n = 0;
    for(let s=0; s<si; s++) n += SECTIONS[s].lessons.length;
    n += li;
    const state = n < COMPLETED ? 'Completed' : (n === COMPLETED ? 'Up next' : 'Locked');

    lessonBody.innerHTML = `
      <div class="drawer-badge" style="color:${sec.accent}">${sec.name} · ${state}</div>
      <h3>${les.t}</h3>
      <div class="drawer-meta"><span>Lesson ${li+1} of ${sec.lessons.length}</span><span>${les.m}</span></div>
      <p class="body">${les.d}</p>
      <h5>What this session includes</h5>
      <ul>
        <li>Guided walkthrough with annotated positions</li>
        <li>Drill set calibrated to your last three games</li>
        <li>Coach notes added after your attempt</li>
      </ul>
      <button class="btn-primary" ${state === 'Locked' ? 'disabled' : ''}>
        ${state === 'Completed' ? 'Review lesson' : state === 'Locked' ? 'Complete earlier lessons first' : 'Begin lesson'}
      </button>`;
    lessonDrawer.classList.add('is-open');
    lessonScrim.classList.add('is-open');
  }
  function closeLesson(){ lessonDrawer.classList.remove('is-open'); lessonScrim.classList.remove('is-open'); }

  pathNodes.forEach(n=>{
    n.addEventListener('click', ()=> openLesson(+n.dataset.section, +n.dataset.lesson));
  });
  document.getElementById('lessonClose').addEventListener('click', closeLesson);
  lessonScrim.addEventListener('click', closeLesson);
})();

/* ---------- nav: the log-in dropdown ----------
   Student or school. On a pointer device it opens on hover; on a touch screen
   the first tap opens it and the link still works on the second, so the
   button keeps its no-JavaScript destination. */
(function(){
  const box = document.querySelector('[data-nav-login]');
  if(!box) return;
  const btn = box.querySelector('.nav-cta');
  const coarse = matchMedia('(hover: none)').matches;
  let shut = null;

  function open(){
    box.classList.add('is-open');
    btn.setAttribute('aria-expanded','true');
    clearTimeout(shut);
  }
  function close(){
    box.classList.remove('is-open');
    btn.setAttribute('aria-expanded','false');
  }

  if(!coarse){
    box.addEventListener('pointerenter', open);
    box.addEventListener('pointerleave', function(){ shut = setTimeout(close, 140); });
  }

  btn.addEventListener('click', function(e){
    /* first tap opens the choice rather than jumping straight to the school */
    if(!box.classList.contains('is-open')){ e.preventDefault(); open(); }
  });

  box.addEventListener('focusin', open);
  box.addEventListener('focusout', function(e){
    if(!box.contains(e.relatedTarget)) close();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && box.classList.contains('is-open')){
      /* focus first: doing it after close() fires focusin and reopens it */
      btn.focus();
      close();
    }
  });
  document.addEventListener('click', function(e){
    if(!box.contains(e.target)) close();
  });
})();

/* ---------- nav: the Tools slide-down panel ---------- */
(function(){
  const drops = Array.prototype.slice.call(document.querySelectorAll('[data-nav-drop]'));
  if(!drops.length) return;

  const coarse = matchMedia('(hover: none)').matches;

  function open(drop){
    drops.forEach(d => { if(d !== drop) close(d); });
    drop.classList.add('is-open');
    const btn = drop.querySelector('.nav-drop-btn');
    if(btn) btn.setAttribute('aria-expanded', 'true');
  }
  function close(drop){
    drop.classList.remove('is-open');
    const btn = drop.querySelector('.nav-drop-btn');
    if(btn) btn.setAttribute('aria-expanded', 'false');
  }
  function closeAll(){ drops.forEach(close); }

  drops.forEach(function(drop){
    const btn = drop.querySelector('.nav-drop-btn');
    if(!btn) return;

    btn.addEventListener('click', function(e){
      e.preventDefault();
      drop.classList.contains('is-open') ? close(drop) : open(drop);
    });

    /* pointer devices get it on hover; touch devices keep the tap above */
    if(!coarse){
      let leaveTimer = null;
      drop.addEventListener('pointerenter', function(){
        clearTimeout(leaveTimer);
        open(drop);
      });
      drop.addEventListener('pointerleave', function(){
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(function(){ close(drop); }, 140);
      });
    }

    /* leaving the panel by keyboard closes it behind you */
    drop.addEventListener('focusout', function(e){
      if(!drop.contains(e.relatedTarget)) close(drop);
    });
  });

  document.addEventListener('click', function(e){
    if(!e.target.closest || !e.target.closest('[data-nav-drop]')) closeAll();
  });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    const openDrop = drops.find(function(d){ return d.classList.contains('is-open'); });
    if(!openDrop) return;
    close(openDrop);
    const btn = openDrop.querySelector('.nav-drop-btn');
    if(btn) btn.focus();
  });
})();

/* ---------- hero: the C-words trade places ---------- */
(function(){
  const rig = document.getElementById('cwordRig');
  if(!rig) return;

  const words = Array.prototype.slice.call(rig.querySelectorAll('.cword'));
  if(words.length < 2) return;

  const DWELL_MS = 2400;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let i = 0;
  words[0].classList.add('is-in');
  requestAnimationFrame(function(){ rig.classList.add('is-live'); });

  if(still) return;   /* the first word simply stays put */

  let timer = null;
  function advance(){
    const outgoing = words[i];
    i = (i + 1) % words.length;
    const incoming = words[i];

    outgoing.classList.remove('is-in');
    outgoing.classList.add('is-out');
    /* the rule retracts and redraws so it tracks the new word's width */
    rig.classList.remove('is-live');

    incoming.classList.remove('is-out');
    requestAnimationFrame(function(){
      incoming.classList.add('is-in');
      rig.classList.add('is-live');
    });

    /* park the outgoing word back below, ready for its next turn */
    setTimeout(function(){ outgoing.classList.remove('is-out'); }, 700);
  }

  function start(){ if(!timer) timer = setInterval(advance, DWELL_MS); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  document.addEventListener('visibilitychange', function(){
    document.hidden ? stop() : start();
  });
  new IntersectionObserver(function(entries){
    entries.forEach(function(en){ en.isIntersecting ? start() : stop(); });
  }, { threshold:0.1 }).observe(rig);

  start();
})();

/* ---------- nav: the mobile drawer ----------
   Built from the desktop nav rather than repeated in every page's markup, so
   the two can never drift apart. The button is created here too: if this
   script fails, no dead control is left behind in the bar. */
(function(){
  const nav = document.querySelector('.nav');
  const links = nav && nav.querySelector('.nav-links');
  const actions = nav && nav.querySelector('.nav-actions');
  if(!nav || !links || !actions) return;
  if(document.querySelector('.nav-burger')) return;

  const CUR = 'aria-current';

  /* ---- read the desktop nav into a plain structure ---- */
  const model = Array.prototype.map.call(links.children, function(el){
    if(el.matches('a')){
      return { kind:'link', label:el.textContent.trim(), href:el.getAttribute('href'),
               current:el.hasAttribute(CUR) };
    }
    const btn = el.querySelector('.nav-drop-btn');
    if(!btn) return null;
    return {
      kind:'group',
      label:btn.textContent.trim(),
      current:btn.hasAttribute(CUR),
      items:Array.prototype.map.call(el.querySelectorAll('.nav-panel-item'), function(a){
        return {
          label:a.querySelector('.npi-label').textContent.trim(),
          desc: a.querySelector('.npi-desc').textContent.trim(),
          href: a.getAttribute('href')
        };
      })
    };
  }).filter(Boolean);

  const login = actions.querySelector('.nav-cta');
  const demo  = actions.querySelector('.nav-demo');

  /* ---- build the control and the panel ---- */
  const burger = document.createElement('button');
  burger.type = 'button';
  burger.className = 'nav-burger';
  burger.setAttribute('aria-label', 'Open menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-controls', 'mobileMenu');
  burger.innerHTML = '<span class="burger-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
  actions.appendChild(burger);

  const scrim = document.createElement('div');
  scrim.className = 'menu-scrim';

  const menu = document.createElement('nav');
  menu.className = 'mobile-menu';
  menu.id = 'mobileMenu';
  menu.setAttribute('aria-label', 'Main menu');

  const esc = function(v){ return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); };

  let html = '<p class="mm-head">Menu</p>';
  model.forEach(function(entry, i){
    const cur = entry.current ? ' aria-current="page"' : '';
    if(entry.kind === 'link'){
      html += '<div class="mm-item" style="--i:' + i + '">' +
                '<a class="mm-link" href="' + esc(entry.href) + '"' + cur + '>' + esc(entry.label) + '</a>' +
              '</div>';
      return;
    }
    const panelId = 'mmAcc' + i;
    html += '<div class="mm-item" style="--i:' + i + '">' +
              '<button class="mm-acc-btn" type="button" aria-expanded="false" aria-controls="' + panelId + '"' + cur + '>' +
                esc(entry.label) + '<span class="nav-caret" aria-hidden="true"></span>' +
              '</button>' +
              '<div class="mm-acc-panel" id="' + panelId + '"><div class="mm-acc-inner">' +
                entry.items.map(function(it){
                  return '<a class="mm-sub" href="' + esc(it.href) + '">' +
                           '<span class="mm-sub-label">' + esc(it.label) + '</span>' +
                           '<span class="mm-sub-desc">' + esc(it.desc) + '</span>' +
                         '</a>';
                }).join('') +
              '</div></div>' +
            '</div>';
  });

  html += '<div class="mm-foot">';
  if(login) html += '<a class="nav-cta" href="' + esc(login.getAttribute('href')) + '">' + esc(login.textContent.trim()) + '</a>';
  /* the label is read off the nav button, so the two can never drift apart */
  if(demo)  html += '<p class="mm-foot-note">Or <a href="' + esc(demo.getAttribute('href')) + '" data-book-demo>' +
                    esc(demo.textContent.trim().toLowerCase()) + '</a> to see how it works.</p>';
  html += '</div>';

  menu.innerHTML = html;
  document.body.appendChild(scrim);
  document.body.appendChild(menu);

  /* ---- open / close ---- */
  const root = document.documentElement;
  let isOpen = false;

  function focusables(){
    return Array.prototype.filter.call(
      menu.querySelectorAll('a[href], button:not([disabled])'),
      function(el){ return el.offsetParent !== null || el === document.activeElement; }
    );
  }

  function open(){
    if(isOpen) return;
    isOpen = true;
    menu.removeAttribute('inert');
    menu.classList.add('is-open');
    scrim.classList.add('is-open');
    root.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    const first = focusables()[0];
    if(first) setTimeout(function(){ first.focus(); }, 260);
  }

  function close(returnFocus){
    if(!isOpen) return;
    isOpen = false;
    menu.classList.remove('is-open');
    scrim.classList.remove('is-open');
    root.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    menu.setAttribute('inert', '');
    if(returnFocus) burger.focus();
  }

  menu.setAttribute('inert', '');

  burger.addEventListener('click', function(){ isOpen ? close(true) : open(); });
  scrim.addEventListener('click', function(){ close(false); });

  /* a tap on any destination closes it — same-page anchors would otherwise leave it open */
  menu.addEventListener('click', function(e){
    const acc = e.target.closest('.mm-acc-btn');
    if(acc){
      const on = acc.getAttribute('aria-expanded') === 'true';
      acc.setAttribute('aria-expanded', on ? 'false' : 'true');
      return;
    }
    if(e.target.closest('a')) close(false);
  });

  document.addEventListener('keydown', function(e){
    if(!isOpen) return;
    if(e.key === 'Escape'){ e.preventDefault(); close(true); return; }
    if(e.key !== 'Tab') return;
    /* keep the tab ring inside the drawer while it is up */
    const f = focusables();
    if(!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if(e.shiftKey && (document.activeElement === first || !menu.contains(document.activeElement))){
      e.preventDefault(); last.focus();
    } else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault(); first.focus();
    }
  });

  /* rotating back to a wide viewport hands over to the desktop nav */
  const wide = matchMedia('(min-width:861px)');
  (wide.addEventListener ? wide.addEventListener.bind(wide, 'change') : wide.addListener.bind(wide))(function(e){
    if(e.matches) close(false);
  });
})();

/* ---------- a place for every player: the level cards ---------- */
(function(){
  const section = document.getElementById('levels');
  if(!section) return;

  const cards = section.querySelectorAll('.level-card');
  if(!cards.length) return;

  /* the CSS already leaves them visible when motion is reduced */
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    cards.forEach(function(c){ c.classList.add('is-in'); });
    return;
  }

  const io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      e.target.classList.add('is-in');   /* the stagger comes from CSS transition-delay */
      io.unobserve(e.target);
    });
  }, { threshold:0.18 });

  cards.forEach(function(c){ io.observe(c); });
})();

/* ---------- school split: the two dashboard panels ----------
   The bars, ring and ticks are pure CSS keyed off .is-in; this only
   drives the numbers, which have to be counted rather than tweened. */
(function(){
  const section = document.getElementById('school');
  if(!section) return;

  const cards = Array.prototype.slice.call(section.querySelectorAll('.ss-card'));
  if(!cards.length) return;

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(el){
    const to   = Number(el.dataset.countTo);
    const from = el.dataset.countFrom !== undefined ? Number(el.dataset.countFrom) : 0;
    const suffix = el.dataset.suffix || '';
    if(Number.isNaN(to)) return;

    if(still){ el.textContent = to + suffix; return; }

    const DURATION = 1400, DELAY = 350;
    let started = null;

    function frame(now){
      if(started === null) started = now;
      const t = Math.min(1, (now - started) / DURATION);
      /* the same ease the rest of the section uses, so it lands together */
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased) + suffix;
      if(t < 1) requestAnimationFrame(frame);
    }
    setTimeout(function(){ requestAnimationFrame(frame); }, DELAY);
  }

  function play(card){
    card.classList.add('is-in');
    card.querySelectorAll('[data-count-to]').forEach(countUp);
  }

  if(still){ cards.forEach(play); return; }

  const io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      play(e.target);
      io.unobserve(e.target);
    });
  }, { threshold:0.3 });

  cards.forEach(function(c){ io.observe(c); });
})();

/* ---------- why nexus: header, reasons and the comparison ---------- */
(function(){
  const page = document.querySelector('.why-page');
  if(!page) return;

  const head  = page.querySelector('.reveal');
  const cards = Array.prototype.slice.call(page.querySelectorAll('.why-card'));
  const rows  = Array.prototype.slice.call(page.querySelectorAll('.vs-row'));

  /* the CSS already draws the finished state when motion is reduced */
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    if(head) head.classList.add('is-in');
    cards.concat(rows).forEach(function(el){ el.classList.add('is-in'); });
    return;
  }

  /* one observer for the lot — each element carries its own delay in CSS */
  const io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold:0.2 });

  if(head) io.observe(head);
  cards.forEach(function(c){ io.observe(c); });

  /* the table rows cascade rather than each waiting for its own threshold */
  rows.forEach(function(r, i){ r.style.transitionDelay = (i * 70) + 'ms'; io.observe(r); });
})();

/* ---------- why nexus: cursor parallax over the header pieces ---------- */
(function(){
  const head  = document.querySelector('.wn-head');
  const stage = head && head.querySelector('.wn-stage');
  if(!stage) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(matchMedia('(hover: none)').matches) return;          /* nothing to track on a touch screen */

  const spot   = stage.querySelector('.wn-spot');
  const pieces = Array.prototype.slice.call(stage.querySelectorAll('.wn-piece'));
  let queued = false, mx = 0, my = 0;

  function paint(){
    queued = false;
    pieces.forEach(function(el){
      const d = parseFloat(el.dataset.depth) || 1;
      /* the deeper the piece, the further it travels — the usual parallax cue */
      el.style.setProperty('--px', (mx * d * 5).toFixed(1) + 'px');
      el.style.setProperty('--py', (my * d * 4).toFixed(1) + 'px');
    });
  }

  /* the pieces stand outside the centred text column, so track the whole
     section — binding to the header alone misses the area they occupy */
  const scope = head.closest('.why-page') || head;

  scope.addEventListener('pointermove', function(e){
    const r = stage.getBoundingClientRect();
    const clamp = function(v){ return Math.max(-0.5, Math.min(0.5, v)); };
    mx = clamp((e.clientX - r.left) / r.width  - 0.5);
    my = clamp((e.clientY - r.top)  / r.height - 0.5);
    if(spot){
      spot.style.setProperty('--mx', ((mx + 0.5) * 100).toFixed(1) + '%');
      spot.style.setProperty('--my', ((my + 0.5) * 100).toFixed(1) + '%');
    }
    if(!queued){ queued = true; requestAnimationFrame(paint); }
  });

  scope.addEventListener('pointerleave', function(){
    mx = 0; my = 0;
    if(!queued){ queued = true; requestAnimationFrame(paint); }
  });
})();

/* ---------- our students, their stories ----------
   The line draws itself against scroll position; each story lights its node
   and reveals photo, then words, then badge. No scroll hijacking — the page
   scrolls normally and this only reads where it has got to. */
(function(){
  const section = document.getElementById('stories');
  if(!section) return;

  const open     = document.getElementById('stOpen');
  const timeline = document.getElementById('stTimeline');
  const draw     = document.getElementById('stDraw');
  const close    = document.getElementById('stClose');
  const stories  = Array.prototype.slice.call(section.querySelectorAll('.st-story, .st-pull, .st-result'));

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(still){
    /* the cards are already in their finished state in the CSS; just mark
       them so the nodes read as lit. The line is drawn in full below. */
    [open, close].forEach(function(el){ if(el) el.classList.add('is-in'); });
    stories.forEach(function(el){ el.classList.add('is-in'); });
  } else {
    /* ---- reveal each block once ---- */
    const io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold:0.22, rootMargin:'0px 0px -8% 0px' });

    if(open)  io.observe(open);
    if(close) io.observe(close);
    stories.forEach(function(el){ io.observe(el); });
  }

  /* ---- the line ----
     Built from where the nodes actually are, so it threads through every
     milestone at any width, and again on the mobile layout where the nodes
     move to the left. Rebuilt on resize; redrawn on scroll. */
  const track = document.getElementById('stTrack');
  const rail  = document.getElementById('stRail');
  if(!draw || !rail || !track || !timeline) return;

  let length = 0, ticking = false, visible = false;

  function build(){
    const box = timeline.getBoundingClientRect();
    const W = Math.round(box.width), H = Math.round(box.height);
    if(!W || !H) return;

    const nodes = Array.prototype.map.call(section.querySelectorAll('.st-node'), function(n){
      const r = n.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    });
    if(!nodes.length) return;

    /* enter at the first node's column, leave at the last one's */
    const pts = [{ x: nodes[0].x, y: 0 }].concat(nodes, [{ x: nodes[nodes.length - 1].x, y: H }]);

    let d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for(let i = 1; i < pts.length; i++){
      const a = pts[i - 1], b = pts[i];
      const dy = b.y - a.y;
      /* bow alternately left and right between milestones — the wind */
      const bow = Math.min(58, Math.abs(dy) * 0.22) * (i % 2 ? 1 : -1);
      d += ' C' + (a.x + bow).toFixed(1) + ' ' + (a.y + dy * 0.34).toFixed(1) +
           ',' + (b.x + bow).toFixed(1) + ' ' + (b.y - dy * 0.34).toFixed(1) +
           ',' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }

    track.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    track.setAttribute('width', W);
    track.setAttribute('height', H);
    rail.setAttribute('d', d);
    draw.setAttribute('d', d);

    length = draw.getTotalLength();
    draw.style.strokeDasharray = length;
    paint();
  }

  function paint(){
    ticking = false;
    if(!length) return;
    if(still){ draw.style.strokeDashoffset = '0'; return; }
    const r = timeline.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    /* 0 when the timeline's top reaches ~72% down the viewport, 1 once its
       bottom has risen past ~62% — the line stays a little ahead of the
       story being read */
    const start = vh * 0.72;
    const end   = vh * 0.62;
    const total = r.height + start - end;
    const p = total <= 0 ? 1 : Math.max(0, Math.min(1, (start - r.top) / total));
    draw.style.strokeDashoffset = String(length * (1 - p));
  }

  function onScroll(){
    if(ticking || !visible) return;
    ticking = true;
    requestAnimationFrame(paint);
  }

  if(!still){
    new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        visible = en.isIntersecting;
        if(visible) paint();
      });
    }, { rootMargin:'160px 0px' }).observe(timeline);

    addEventListener('scroll', onScroll, { passive:true });
  }

  let resizeTimer = null;
  addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 140);
  }, { passive:true });

  /* the cards shift as photographs load, so measure again once they have */
  build();
  addEventListener('load', build);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(build);
})();

/* ---------- the closing invitation ---------- */
(function(){
  const band = document.querySelector('.cta-band');
  if(!band) return;

  /* the CSS already draws the finished state when motion is reduced */
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    band.classList.add('is-in');
    return;
  }

  const io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      e.target.classList.add('is-in');   /* the stagger lives in the CSS */
      io.unobserve(e.target);
    });
  }, { threshold:0.3 });

  io.observe(band);
})();

/* ---------- hero: the headline lines rise on load ---------- */
(function(){
  const col = document.getElementById('heroText');
  if(!col) return;

  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
    col.classList.add('is-in');
    return;
  }
  /* the hero is above the fold, so it plays straight away rather than
     waiting for a scroll that may never come */
  requestAnimationFrame(function(){
    setTimeout(function(){ col.classList.add('is-in'); }, 120);
  });
})();

/* ---------- students with two photographs ----------
   The pair crossfades on its own and can be driven by the dots. Pauses
   while the pointer is on it, and holds still under reduced motion. */
(function(){
  const swaps = Array.prototype.slice.call(document.querySelectorAll('.st-swap'));
  if(!swaps.length) return;

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DWELL = 4200;

  swaps.forEach(function(swap){
    const shots = Array.prototype.slice.call(swap.querySelectorAll('img'));
    if(shots.length < 2) { if(shots[0]) shots[0].classList.add('is-live'); return; }

    const caps = Array.prototype.slice.call(
      (swap.parentNode.querySelector('.st-caps') || swap).querySelectorAll('.st-cap'));
    const dots = Array.prototype.slice.call(swap.querySelectorAll('.st-swap-dot'));
    let at = 0, timer = null, held = false;

    function show(n){
      at = (n + shots.length) % shots.length;
      shots.forEach(function(s, i){ s.classList.toggle('is-live', i === at); });
      caps.forEach(function(c, i){ c.classList.toggle('is-live', i === at); });
      dots.forEach(function(d, i){
        d.classList.toggle('is-on', i === at);
        d.setAttribute('aria-selected', String(i === at));
      });
    }

    function start(){ if(!timer && !still && !held) timer = setInterval(function(){ show(at + 1); }, DWELL); }
    function stop(){ if(timer){ clearInterval(timer); timer = null; } }

    dots.forEach(function(d, i){
      d.addEventListener('click', function(){ stop(); show(i); start(); });
    });
    swap.addEventListener('pointerenter', function(){ held = true; stop(); });
    swap.addEventListener('pointerleave', function(){ held = false; start(); });

    show(0);
    if(still) return;
    /* only runs while it is on screen */
    new IntersectionObserver(function(entries){
      entries.forEach(function(e){ e.isIntersecting ? start() : stop(); });
    }, { threshold:0.25 }).observe(swap);
  });
})();

/* ---------- film strip ----------
   Two photographs in one clipped frame; the reel behind them glides by one
   cell so the pair reads as a continuous vertical strip. Auto-advances after
   a dwell, pauses on hover / focus / manual input, and never fights the page
   for a scroll gesture. */
(function(){
  const films = Array.prototype.slice.call(document.querySelectorAll('[data-film]'));
  if(!films.length) return;

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  films.forEach(function(film){
    const reel  = film.querySelector('.film-reel');
    const cells = Array.prototype.slice.call(film.querySelectorAll('.film-cell'));
    const caps  = Array.prototype.slice.call(film.querySelectorAll('.film-cap span'));
    const rail  = film.querySelector('.film-rail i');
    const num   = film.querySelector('.film-count b');
    const toggle= film.querySelector('.film-toggle');
    if(!reel || cells.length < 2) return;

    const DWELL = parseInt(getComputedStyle(film).getPropertyValue('--film-dwell'), 10) || 5000;
    const total = cells.length;
    film.style.setProperty('--film-count', total);

    let at = 0;
    let timer = null;
    let playing = false;
    let held = false;        // pointer resting on it, or focus inside
    let stopped = still;     // a deliberate choice turns the cycling off

    /* ---- paint ---- */
    function paint(instant){
      if(instant){
        reel.classList.add('is-instant');
        void reel.offsetWidth;
      }
      film.style.setProperty('--film-at', at);
      if(instant) requestAnimationFrame(function(){ reel.classList.remove('is-instant'); });

      cells.forEach(function(c, i){ c.classList.toggle('is-live', i === at); });
      caps.forEach(function(c, i){ c.classList.toggle('is-live', i === at); });

      if(num){
        num.classList.add('is-turning');
        setTimeout(function(){
          num.textContent = String(at + 1).padStart(2, '0');
          num.classList.remove('is-turning');
        }, 180);
      }
      cells.forEach(function(c, i){
        const img = c.querySelector('img');
        if(img) img.setAttribute('aria-hidden', String(i !== at));
      });
    }

    /* ---- the cycle ---- */
    function restartMotion(){
      /* retrigger the rail fill and the slow push-in for the new cell */
      film.classList.remove('is-playing');
      void film.offsetWidth;
      if(playing) film.classList.add('is-playing');
    }

    function go(n, why){
      at = ((n % total) + total) % total;
      paint(false);
      restartMotion();
      if(why === 'manual') arm();       // a manual move restarts the dwell
    }

    function arm(){
      clearTimeout(timer);
      timer = null;
      if(stopped || held || !playing) return;
      timer = setTimeout(function(){ go(at + 1, 'auto'); arm(); }, DWELL + 60);
    }

    function play(){
      if(stopped) return;
      playing = true;
      film.classList.remove('is-paused');
      film.classList.add('is-playing');
      restartMotion();
      arm();
    }
    function pause(){
      playing = false;
      film.classList.add('is-paused');
      clearTimeout(timer); timer = null;
    }

    /* ---- controls ---- */
    const prev = film.querySelector('[data-film-prev]');
    const next = film.querySelector('[data-film-next]');
    if(prev) prev.addEventListener('click', function(){ go(at - 1, 'manual'); });
    if(next) next.addEventListener('click', function(){ go(at + 1, 'manual'); });

    if(toggle){
      toggle.addEventListener('click', function(){
        if(playing){ stopped = true; pause(); toggle.setAttribute('aria-label', 'Play'); }
        else { stopped = false; play(); toggle.setAttribute('aria-label', 'Pause'); }
      });
    }

    /* hovering or tabbing in holds it, without cancelling the run */
    film.addEventListener('pointerenter', function(){ held = true; clearTimeout(timer); timer = null; film.classList.add('is-paused'); });
    film.addEventListener('pointerleave', function(){ held = false; if(!stopped && playing){ film.classList.remove('is-paused'); arm(); } });
    film.addEventListener('focusin',  function(){ held = true; clearTimeout(timer); timer = null; film.classList.add('is-paused'); });
    film.addEventListener('focusout', function(e){
      if(film.contains(e.relatedTarget)) return;
      held = false; if(!stopped && playing){ film.classList.remove('is-paused'); arm(); }
    });

    /* arrow keys while the frame has focus */
    film.addEventListener('keydown', function(e){
      if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){ e.preventDefault(); go(at - 1, 'manual'); }
      else if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){ e.preventDefault(); go(at + 1, 'manual'); }
    });

    /* ---- vertical swipe, without stealing the page's scroll ----
       Nothing is preventDefault-ed. The gesture only counts if the page did
       not scroll during it, which is exactly the case when the visitor holds
       and drags on the picture rather than flicking the document. */
    const frame = film.querySelector('.film-frame');
    let sy = 0, sx = 0, st0 = 0, scrollAt = 0, tracking = false;

    frame.addEventListener('pointerdown', function(e){
      tracking = true; sy = e.clientY; sx = e.clientX; st0 = Date.now();
      scrollAt = window.scrollY;
    });
    window.addEventListener('pointerup', function(e){
      if(!tracking) return;
      tracking = false;
      const dy = e.clientY - sy, dx = e.clientX - sx;
      const pageMoved = Math.abs(window.scrollY - scrollAt) > 4;
      const quick = Date.now() - st0 < 700;
      if(pageMoved) return;                                  // that was a scroll
      if(Math.abs(dy) < 45 || Math.abs(dx) > Math.abs(dy)) return;
      if(!quick) return;
      go(dy < 0 ? at + 1 : at - 1, 'manual');
    });

    /* ---- start: decode both, reveal, then let it run ---- */
    const imgs = Array.prototype.slice.call(film.querySelectorAll('img'));
    function ready(){
      return Promise.all(imgs.map(function(img){
        if(img.complete && img.naturalWidth) return Promise.resolve();
        return img.decode ? img.decode().catch(function(){}) :
          new Promise(function(r){ img.addEventListener('load', r, { once:true }); img.addEventListener('error', r, { once:true }); });
      }));
    }

    paint(true);

    new IntersectionObserver(function(entries, obs){
      entries.forEach(function(en){
        if(!en.isIntersecting){ if(!stopped) { clearTimeout(timer); timer = null; } return; }
        obs.unobserve(film);
        imgs.forEach(function(i){ i.loading = 'eager'; });
        ready().then(function(){
          film.classList.add('is-in');
          if(still){ film.classList.add('is-paused'); return; }
          /* let the first photograph settle before anything moves */
          setTimeout(play, 900);
        });
      });
    }, { threshold:0.25 }).observe(film);

    /* off-screen means off duty once it is running */
    new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ if(playing && !held && !stopped) arm(); }
        else { clearTimeout(timer); timer = null; }
      });
    }, { threshold:0.1 }).observe(film);
  });
})();
