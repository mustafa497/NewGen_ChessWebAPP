/* ================= BOOK A FREE DEMO CLASS =================
   Opens from the "Book a demo class" button in the nav. The markup is built
   here rather than repeated in twelve pages, so there is one copy of it.

   WHERE THE DATA GOES
   -------------------
   The site is static, so it cannot write to a spreadsheet by itself. Put the
   URL of a Google Apps Script web app in ENDPOINT below and every request is
   posted to it; the script appends a row to the sheet. The script to deploy
   is in tools/booking-endpoint.gs, with the steps in tools/README.md.

   Until ENDPOINT is filled in, the form says so on screen and calls itself a
   preview rather than pretending a request was sent.
   ========================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     CONFIGURATION — the two lines you edit after deploying the script
     --------------------------------------------------------------- */
  var ENDPOINT = '';          // e.g. 'https://script.google.com/macros/s/AKfy.../exec'
  var TOKEN    = 'nexus_uWWd9Zad2co7MZ0lqkRbktYV';          // must match SHARED_TOKEN in the Apps Script

  /* Digits only, with the country code and no '+' or spaces, e.g. '923001234567'.
     Leave it empty and every WhatsApp fallback below simply does not appear. */
  var WHATSAPP = '';

  var TIMEZONE_LABEL = 'Pakistan Standard Time (PKT, UTC+5)';
  var TIMEOUT_MS = 15000;

  var trigger = document.querySelector('.nav-demo');
  if (!trigger) return;

  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- country codes: Pakistan first, then the ones most likely here ---- */
  var DIALS = [
    ['+92', 'Pakistan'], ['+91', 'India'], ['+971', 'UAE'], ['+966', 'Saudi Arabia'],
    ['+44', 'United Kingdom'], ['+1', 'USA / Canada'], ['+61', 'Australia'],
    ['+974', 'Qatar'], ['+973', 'Bahrain'], ['+968', 'Oman'], ['+965', 'Kuwait'],
    ['+60', 'Malaysia'], ['+65', 'Singapore'], ['+90', 'Türkiye'], ['+49', 'Germany'],
    ['+33', 'France'], ['+31', 'Netherlands'], ['+39', 'Italy'], ['+34', 'Spain'],
    ['+46', 'Sweden'], ['+47', 'Norway'], ['+353', 'Ireland'], ['+27', 'South Africa'],
    ['+880', 'Bangladesh'], ['+94', 'Sri Lanka'], ['+86', 'China'], ['+81', 'Japan'],
    ['+64', 'New Zealand'], ['+20', 'Egypt'], ['+98', 'Iran'], ['+93', 'Afghanistan']
  ];

  var FORMATS = [
    ['online',  'Online',            'A video call, board on screen',
      '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'],
    ['home',    'At your home',      'A coach comes to you',
      '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>'],
    ['academy', 'At the academy',    'In person, with other students',
      '<svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-5h6v5"/><path d="M9 11h2M13 11h2"/></svg>']
  ];

  var DAYS = ['No preference', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SLOTS = [
    'No preference',
    'Morning (9am – 12pm)',
    'Afternoon (12pm – 4pm)',
    'After school (4pm – 7pm)',
    'Evening (7pm – 9pm)'
  ];

  var EXPERIENCE = [
    ['new',     'New to chess',          'Has never really played',
      '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/></svg>'],
    ['basics',  'Know the basics',       'Knows how the pieces move',
      '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'],
    ['regular', 'Already play regularly', 'Plays games, maybe online',
      '<svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>']
  ];

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* the same Staunton knight the hero uses, so the brand carries through */
  var KNIGHT =
    '<svg viewBox="0 0 64 92" fill="none" aria-hidden="true">' +
      '<defs><linearGradient id="bkKnightG" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#f7fcff" stop-opacity="0.97"/>' +
        '<stop offset="55%" stop-color="#7fd8ff" stop-opacity="0.5"/>' +
        '<stop offset="100%" stop-color="#c9a66b" stop-opacity="0.55"/>' +
      '</linearGradient></defs>' +
      '<path d="M19 72C18 61 18 51 23 45C20 44.5 15 45 11 44C7.5 43 5.5 40.5 6.5 37.5' +
        'C7.5 34.5 10.5 32.5 14 31.5C17 30.7 19.5 29.5 21.5 27C24 22.5 27 17.5 30 13.5' +
        'L31.5 5L38 12C44.5 17.5 48 28 48 40.5C48 55 47 65 46 72Z" ' +
        'fill="url(#bkKnightG)" stroke="#d9f4ff" stroke-opacity="0.6" stroke-width="1"/>' +
      '<path d="M33 9C40 15.5 44.5 26 44.5 40.5C44.5 55 43.5 65 43 72L38.5 72' +
        'C39.5 63 40.5 52 40 41C39.4 28.5 36 18 30.5 12.5Z" fill="#d9f4ff" fill-opacity="0.22"/>' +
      '<g stroke="#0a0d14" stroke-opacity="0.34" stroke-width="1.3" stroke-linecap="round">' +
        '<path d="M37 18.6L41.2 20.6"/><path d="M39.1 28.4L43.2 30.1"/><path d="M40 39.2L44.1 40.4"/>' +
        '<path d="M39.8 50L43.9 50.8"/><path d="M39.4 60.8L43.5 61.3"/></g>' +
      '<path d="M7 40.5C10 41.5 13.5 41.5 16.5 40.5" stroke="#d9f4ff" stroke-opacity="0.5" stroke-width="1.1"/>' +
      '<ellipse cx="9.6" cy="36.4" rx="1.5" ry="1.15" fill="#0a0705" fill-opacity="0.8"/>' +
      '<circle cx="22.6" cy="27.6" r="2" fill="#0a0705"/>' +
      '<path d="M15 80L19 72L46 72L50 80Z" fill="url(#bkKnightG)" stroke="#d9f4ff" stroke-opacity="0.45" stroke-width="1"/>' +
      '<rect x="8" y="80" width="48" height="10" rx="2" fill="url(#bkKnightG)"/>' +
    '</svg>';

  var PAWN =
    '<svg viewBox="0 0 64 92" fill="none" aria-hidden="true">' +
      '<circle cx="32" cy="24" r="12" fill="currentColor"/>' +
      '<path d="M32 36C24 44 20 56 24 68H40C44 56 40 44 32 36Z" fill="currentColor"/>' +
      '<rect x="17" y="68" width="30" height="9" rx="2" fill="currentColor"/>' +
    '</svg>';

  var TICK = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
  var WA_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.3a8.5 8.5 0 1 1 15.4-4.6z"/>' +
      '<path d="M9 9.2c.3-.7.6-.7.9-.7h.7c.2 0 .5 0 .7.6l.8 1.9c.1.3 0 .5-.1.7l-.4.5c-.1.2-.3.4-.1.7' +
        'a6.3 6.3 0 0 0 2.9 2.5c.3.1.5 0 .7-.2l.5-.6c.2-.2.4-.2.6-.1l1.8.9c.3.1.5.3.5.5v.7' +
        'c0 .5-.4 1.1-.9 1.3-.5.2-1.2.4-2.2.1a10 10 0 0 1-5.9-4.9c-.6-1.1-.7-2-.6-2.6.1-.5.3-1 .6-1.3z"/>' +
    '</svg>';
  var DOT  = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';

  /* ---------------------------------------------------------------
     MARKUP
     --------------------------------------------------------------- */
  var root = document.createElement('div');
  root.className = 'bk';
  root.id = 'bookDemo';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'bkHeading');

  root.innerHTML =
  '<div class="bk-scrim" data-close></div>' +
  '<div class="bk-card">' +

    /* ---------- the scene ---------- */
    '<aside class="bk-scene">' +
      '<p class="bk-eyebrow">Nexus Chess Academy</p>' +
      '<h2 id="bkHeading">Their next great move starts here.</h2>' +
      '<p class="bk-lede">Book a free demo class. Meet a coach, explore chess and find the right starting point for your child.</p>' +
      '<ul class="bk-points">' +
        '<li>' + DOT + 'Beginner-friendly</li>' +
        '<li>' + DOT + 'Personal guidance</li>' +
        '<li>' + DOT + 'Learn through play</li>' +
      '</ul>' +
      '<div class="bk-stage" aria-hidden="true">' +
        '<div class="bk-board"></div>' +
        '<svg class="bk-path" viewBox="0 0 214 150" fill="none">' +
          '<path d="M24 128 C58 122, 74 96, 96 78 S150 46, 186 30"/>' +
          '<circle cx="186" cy="30" r="3.4"/>' +
        '</svg>' +
        '<span class="bk-blur one">' + PAWN + '</span>' +
        '<span class="bk-blur two">' + PAWN + '</span>' +
        '<span class="bk-knight">' + KNIGHT + '</span>' +
      '</div>' +
    '</aside>' +

    /* ---------- the form ---------- */
    '<div class="bk-form-col">' +
      '<button type="button" class="bk-close" data-close aria-label="Close">' +
        '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +

      '<div class="bk-steps" id="bkSteps">' +
        '<span class="bk-step on" data-s="1"><span class="n">1</span>Meet the player</span>' +
        '<span class="bk-rail"><i id="bkRail"></i></span>' +
        '<span class="bk-step" data-s="2"><span class="n">2</span>Plan the demo</span>' +
      '</div>' +

      '<form class="bk-body" id="bkForm" novalidate>' +
        '<p class="bk-preview" id="bkPreview" hidden>' +
          '<b>Preview.</b> No booking endpoint is connected yet, so nothing is sent or stored. ' +
          '<span id="bkPreviewWa" hidden>Finish the form and you can still send it straight to us ' +
          'on WhatsApp.</span></p>' +
        '<p class="bk-fail" id="bkFail" hidden role="alert"></p>' +

        /* ---- step 1 ---- */
        '<section class="bk-pane on" id="bkPane1">' +
          '<h3>Let&rsquo;s meet your future chess player</h3>' +

          '<div class="bk-field" data-f="parent">' +
            '<label for="bkParent">Parent or guardian&rsquo;s name</label>' +
            '<input id="bkParent" name="parent" type="text" autocomplete="name" ' +
              'maxlength="80" aria-describedby="bkParentErr" required>' +
            '<p class="bk-err" id="bkParentErr"></p>' +
          '</div>' +

          '<div class="bk-row">' +
            '<div class="bk-field" data-f="student">' +
              '<label for="bkStudent">Student&rsquo;s first name</label>' +
              '<input id="bkStudent" name="student" type="text" autocomplete="off" ' +
                'maxlength="60" aria-describedby="bkStudentErr" required>' +
              '<p class="bk-err" id="bkStudentErr"></p>' +
            '</div>' +
            '<div class="bk-field" data-f="age">' +
              '<label for="bkAge">Age</label>' +
              '<input id="bkAge" name="age" type="number" inputmode="numeric" ' +
                'min="3" max="19" step="1" aria-describedby="bkAgeErr" required>' +
              '<p class="bk-err" id="bkAgeErr"></p>' +
            '</div>' +
          '</div>' +

          '<fieldset class="bk-field" data-f="level">' +
            '<legend class="bk-legend">Chess experience</legend>' +
            '<div class="bk-cards">' +
              EXPERIENCE.map(function (x) {
                return '<label class="bk-card-opt">' +
                  '<input type="radio" name="level" value="' + x[0] + '">' +
                  '<span class="ic">' + x[3] + '</span>' +
                  '<span class="tx"><span class="tt">' + x[1] + '</span>' +
                  '<span class="td">' + x[2] + '</span></span>' +
                  '<span class="tick">' + TICK + '</span>' +
                '</label>';
              }).join('') +
            '</div>' +
            '<p class="bk-err" id="bkLevelErr"></p>' +
          '</fieldset>' +

        '</section>' +

        /* ---- step 2 ---- */
        '<section class="bk-pane" id="bkPane2" hidden>' +
          '<h3>Let&rsquo;s find a good time</h3>' +

          '<fieldset class="bk-field" data-f="format">' +
            '<legend class="bk-legend">How would you like the class?</legend>' +
            '<div class="bk-cards">' +
              FORMATS.map(function (x) {
                return '<label class="bk-card-opt">' +
                  '<input type="radio" name="format" value="' + x[0] + '">' +
                  '<span class="ic">' + x[3] + '</span>' +
                  '<span class="tx"><span class="tt">' + x[1] + '</span>' +
                  '<span class="td">' + x[2] + '</span></span>' +
                  '<span class="tick">' + TICK + '</span>' +
                '</label>';
              }).join('') +
            '</div>' +
            '<p class="help" id="bkFormatHint" hidden></p>' +
            '<p class="bk-err" id="bkFormatErr"></p>' +
          '</fieldset>' +

          '<div class="bk-field" data-f="phone">' +
            '<label for="bkPhone">WhatsApp or phone number</label>' +
            '<div class="bk-row phone">' +
              '<select id="bkDial" name="dial" aria-label="Country code">' +
                DIALS.map(function (d) {
                  return '<option value="' + d[0] + '"' + (d[0] === '+92' ? ' selected' : '') + '>' +
                    d[0] + ' ' + esc(d[1].length > 12 ? d[1].slice(0, 11) + '…' : d[1]) + '</option>';
                }).join('') +
              '</select>' +
              '<input id="bkPhone" name="phone" type="tel" inputmode="tel" ' +
                'autocomplete="tel-national" maxlength="20" placeholder="3XX XXXXXXX" ' +
                'aria-describedby="bkPhoneErr" required>' +
            '</div>' +
            '<p class="bk-err" id="bkPhoneErr"></p>' +
          '</div>' +

          '<div class="bk-field" data-f="email">' +
            '<label for="bkEmail">Email address <span class="opt">— optional</span></label>' +
            '<input id="bkEmail" name="email" type="email" inputmode="email" ' +
              'autocomplete="email" maxlength="120" aria-describedby="bkEmailErr">' +
            '<p class="bk-err" id="bkEmailErr"></p>' +
          '</div>' +

          '<div class="bk-field" data-f="city">' +
            '<label for="bkCity">City or area <span class="opt">— optional</span></label>' +
            '<input id="bkCity" name="city" type="text" autocomplete="address-level2" ' +
              'maxlength="80" placeholder="e.g. DHA, Karachi">' +
            '<p class="help">A full home address is not needed for an enquiry.</p>' +
          '</div>' +

          '<div class="bk-row">' +
            '<div class="bk-field" data-f="day">' +
              '<label for="bkDay">Preferred day <span class="opt">— optional</span></label>' +
              '<select id="bkDay" name="day">' +
                DAYS.map(function (d) { return '<option>' + d + '</option>'; }).join('') +
              '</select>' +
            '</div>' +
            '<div class="bk-field" data-f="time" style="min-width:0">' +
              '<label for="bkTime">Preferred time <span class="opt">— optional</span></label>' +
              '<select id="bkTime" name="time">' +
                SLOTS.map(function (d) { return '<option>' + d + '</option>'; }).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<p class="help" id="bkTz" style="margin:-0.5rem 0 1.05rem"></p>' +

          '<div class="bk-field" data-f="notes">' +
            '<label for="bkNotes">Anything the coach should know? <span class="opt">— optional</span></label>' +
            '<textarea id="bkNotes" name="notes" maxlength="500" ' +
              'placeholder="Shy in groups, loves puzzles, already plays with a cousin…"></textarea>' +
          '</div>' +

          '<div class="bk-field" data-f="consent">' +
            '<label class="bk-consent">' +
              '<input type="checkbox" id="bkConsent" name="consent" aria-describedby="bkConsentErr">' +
              '<span>You may contact me about this demo class using the details provided.</span>' +
            '</label>' +
            '<p class="bk-err" id="bkConsentErr"></p>' +
          '</div>' +

          /* a bot that fills every field it finds gives itself away here */
          '<div style="position:absolute;left:-9999px" aria-hidden="true">' +
            '<label for="bkCompany">Company</label>' +
            '<input id="bkCompany" name="company" type="text" tabindex="-1" autocomplete="off">' +
          '</div>' +
        '</section>' +
      '</form>' +

      /* ---------- done ---------- */
      '<section class="bk-done" id="bkDone" tabindex="-1">' +
        '<div class="seal">&#9823;</div>' +
        '<h3 id="bkDoneH">Your next move is in motion! &#9823;</h3>' +
        '<p id="bkDoneP"></p>' +
        '<dl class="bk-summary" id="bkSummary"></dl>' +
        '<div class="bk-done-actions">' +
          '<a class="bk-wa" id="bkWa" hidden target="_blank" rel="noopener">' +
            WA_ICON + '<span>Send it on WhatsApp</span></a>' +
          '<button type="button" class="bk-go" id="bkFinish">Back to Nexus</button>' +
        '</div>' +
      '</section>' +

      '<div class="bk-foot" id="bkFoot">' +
        '<div class="bk-actions">' +
          '<button type="button" class="bk-back" id="bkBack" hidden>&larr; Back</button>' +
          '<button type="submit" class="bk-go" id="bkGo" form="bkForm">' +
            '<span class="spin" aria-hidden="true"></span><span id="bkGoLabel">Next: Plan the demo &rarr;</span>' +
          '</button>' +
        '</div>' +
        '<p class="bk-note" id="bkNote">Free, no obligation. Two short steps.</p>' +
      '</div>' +

    '</div>' +
  '</div>';

  document.body.appendChild(root);

  /* ---------------------------------------------------------------
     REFERENCES
     --------------------------------------------------------------- */
  var $ = function (id) { return document.getElementById(id); };
  var form = $('bkForm'), foot = $('bkFoot'), done = $('bkDone');
  var pane1 = $('bkPane1'), pane2 = $('bkPane2');
  var go = $('bkGo'), goLabel = $('bkGoLabel'), back = $('bkBack'), note = $('bkNote');
  var rail = $('bkRail'), fail = $('bkFail');
  var step = 1, sending = false, lastFocus = null;

  /* server   - posted to the Apps Script, which writes a row to the sheet
     whatsapp - opens WhatsApp with the details written out, ready to send
     preview  - neither is configured, so nothing leaves the page          */
  var MODE = ENDPOINT ? 'server' : (WHATSAPP ? 'whatsapp' : 'preview');
  var live = MODE === 'server';
  /* the banner belongs on a true preview only; WhatsApp really does deliver */
  $('bkPreview').hidden = MODE !== 'preview';
  $('bkPreviewWa').hidden = true;

  /* the visitor's clock, said only when it is not ours */
  (function () {
    var here = '';
    try { here = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    var txt = 'Times are ' + TIMEZONE_LABEL + '.';
    if (here && here !== 'Asia/Karachi') txt += ' Your device is set to ' + here + '.';
    $('bkTz').textContent = txt + ' Day and time are preferences — we will confirm with you.';
  })();

  /* ---------------------------------------------------------------
     VALIDATION — every message names the field and says what to do
     --------------------------------------------------------------- */
  function setErr(name, msg) {
    var wrap = root.querySelector('[data-f="' + name + '"]');
    if (!wrap) return;
    var p = wrap.querySelector('.bk-err');
    wrap.classList.toggle('bad', !!msg);
    if (p) p.textContent = msg || '';
    var input = wrap.querySelector('input, select, textarea');
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function val(id) { return ($(id).value || '').trim(); }

  function checkStep1(report) {
    var bad = null;
    if (!val('bkParent')) { setErr('parent', 'Please tell us your name.'); bad = bad || 'bkParent'; }
    else setErr('parent', '');

    if (!val('bkStudent')) { setErr('student', 'Please add the student’s first name.'); bad = bad || 'bkStudent'; }
    else setErr('student', '');

    var age = parseInt(val('bkAge'), 10);
    if (!val('bkAge')) { setErr('age', 'Age is needed.'); bad = bad || 'bkAge'; }
    else if (isNaN(age) || age < 3 || age > 19) { setErr('age', 'Please enter an age between 3 and 19.'); bad = bad || 'bkAge'; }
    else setErr('age', '');

    var level = form.querySelector('input[name="level"]:checked');
    if (!level) { setErr('level', 'Pick the one that sounds most like them.'); bad = bad || null; }
    else setErr('level', '');

    if (report && bad) { $(bad).focus(); }
    else if (report && !level) {
      var first = form.querySelector('input[name="level"]');
      if (first) first.focus();
    }
    return !bad && !!level;
  }

  function checkStep2(report) {
    var bad = null;

    var fmt = form.querySelector('input[name="format"]:checked');
    if (!fmt) setErr('format', 'Choose how you would like the class to run.');
    else setErr('format', '');

    var phone = val('bkPhone');
    var digits = phone.replace(/[^\d]/g, '');
    if (!phone) { setErr('phone', 'A number lets us confirm the time with you.'); bad = bad || 'bkPhone'; }
    else if (digits.length < 7 || digits.length > 15) { setErr('phone', 'That does not look like a complete number.'); bad = bad || 'bkPhone'; }
    else setErr('phone', '');

    var email = val('bkEmail');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setErr('email', 'Check the email address, or leave it blank.'); bad = bad || 'bkEmail';
    } else setErr('email', '');

    if (!$('bkConsent').checked) { setErr('consent', 'We need your permission before we get in touch.'); bad = bad || 'bkConsent'; }
    else setErr('consent', '');

    if (report && bad) $(bad).focus();
    else if (report && !fmt) {
      var firstFmt = form.querySelector('input[name="format"]');
      if (firstFmt) firstFmt.focus();
    }
    return !bad && !!fmt;
  }

  /* clearing an error as soon as it is being corrected */
  form.addEventListener('input', function (e) {
    var wrap = e.target.closest('[data-f]');
    if (wrap && wrap.classList.contains('bad')) setErr(wrap.dataset.f, '');
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'level' || e.target.name === 'format') {
      setErr(e.target.name === 'level' ? 'level' : 'format', '');
      /* a visible state for engines without :has(); only the group that
         changed is repainted, so the other group keeps its choice */
      var group = e.target.closest('.bk-cards');
      if (group) group.querySelectorAll('.bk-card-opt').forEach(function (l) {
        l.classList.toggle('is-on', l.contains(e.target) && e.target.checked);
      });
    }
    if (e.target.name === 'format') {
      var hint = $('bkFormatHint');
      hint.hidden = e.target.value !== 'home';
      if (!hint.hidden) hint.textContent =
        'We will confirm the area with you before the visit — the city or area below is enough for now.';
    }
    if (e.target.id === 'bkConsent' && e.target.checked) setErr('consent', '');
  });

  /* ---------------------------------------------------------------
     STEPS — nothing typed is ever thrown away by moving between them
     --------------------------------------------------------------- */
  function show(n, backwards) {
    step = n;
    [pane1, pane2].forEach(function (p, i) {
      var on = (i + 1) === n;
      p.hidden = !on;
      p.classList.toggle('on', on);
      p.classList.toggle('back', !!backwards);
    });
    root.querySelectorAll('.bk-step').forEach(function (s) {
      var i = +s.dataset.s;
      s.classList.toggle('on', i === n);
      s.classList.toggle('done', i < n);
    });
    rail.style.width = n === 1 ? '50%' : '100%';
    back.hidden = n === 1;
    goLabel.innerHTML = n === 1 ? 'Next: Plan the demo &rarr;' : 'Request My Free Demo &#9823;';
    note.textContent = n === 1
      ? 'Free, no obligation. Two short steps.'
      : 'Our team will contact you to confirm availability.';
    var focusOn = n === 1 ? $('bkParent') : $('bkPhone');
    if (focusOn) setTimeout(function () { focusOn.focus(); }, still ? 0 : 120);
  }

  back.addEventListener('click', function () { fail.hidden = true; show(1, true); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step === 1) { if (checkStep1(true)) show(2, false); return; }
    if (!checkStep2(true)) return;
    send();
  });

  /* ---------------------------------------------------------------
     SENDING
     --------------------------------------------------------------- */
  function payload() {
    var levelEl = form.querySelector('input[name="level"]:checked');
    var levelText = levelEl
      ? (EXPERIENCE.filter(function (x) { return x[0] === levelEl.value; })[0] || [,''])[1]
      : '';
    var fmtEl = form.querySelector('input[name="format"]:checked');
    var fmtText = fmtEl
      ? (FORMATS.filter(function (x) { return x[0] === fmtEl.value; })[0] || [,''])[1]
      : '';
    return {
      token: TOKEN,
      parent: val('bkParent'),
      student: val('bkStudent'),
      age: val('bkAge'),
      level: levelEl ? levelEl.value : '',
      levelText: levelText,
      format: fmtEl ? fmtEl.value : '',
      formatText: fmtText,
      dial: $('bkDial').value,
      phone: val('bkPhone'),
      email: val('bkEmail'),
      city: val('bkCity'),
      day: $('bkDay').value,
      time: $('bkTime').value,
      notes: val('bkNotes'),
      consent: $('bkConsent').checked ? 'yes' : 'no',
      company: val('bkCompany'),          // honeypot: a real parent leaves it empty
      page: location.pathname,
      submittedAt: new Date().toISOString()
    };
  }

  /* A readable message rather than a dump of field names, so whoever reads it
     on a phone can act on it without decoding anything. */
  function waLink(d) {
    if (!WHATSAPP) return '';
    var lines = [
      'Hello Nexus Chess Academy — I’d like to book a free demo class.',
      '',
      'Parent: ' + d.parent,
      'Student: ' + d.student + ' (age ' + d.age + ')',
      'Experience: ' + d.levelText,
      'Class: ' + d.formatText,
      'Contact: ' + d.dial + ' ' + d.phone
    ];
    if (d.email) lines.push('Email: ' + d.email);
    if (d.city) lines.push('City or area: ' + d.city);
    if (d.day && d.day !== 'No preference') lines.push('Preferred day: ' + d.day);
    if (d.time && d.time !== 'No preference') lines.push('Preferred time: ' + d.time + ' (PKT)');
    if (d.notes) lines.push('Note: ' + d.notes);
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function busy(on) {
    sending = on;
    go.classList.toggle('is-busy', on);
    go.disabled = on;
    back.disabled = on;
    goLabel.innerHTML = on ? 'Sending&hellip;' : 'Request My Free Demo &#9823;';
  }

  function send() {
    var data = payload();
    fail.hidden = true;

    if (MODE === 'whatsapp') {
      /* Opened from inside the click that submitted the form, so the browser
         treats it as wanted rather than as a pop-up. If it is blocked anyway,
         the button on the next screen does the same thing. */
      busy(true);
      var href = waLink(data);
      var win = null;
      try {
        /* passing 'noopener' makes window.open always return null, which made
           every successful open look blocked; drop the reference instead */
        win = window.open(href, '_blank');
        if (win) { try { win.opener = null; } catch (e) {} }
      } catch (e) {}
      setTimeout(function () { busy(false); finish(data, 'whatsapp', !win); }, 320);
      return;
    }

    if (MODE === 'preview') {
      /* Nothing configured: say so rather than faking a success. */
      busy(true);
      setTimeout(function () { busy(false); finish(data, 'preview'); }, 520);
      return;
    }

    busy(true);
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);

    fetch(ENDPOINT, {
      method: 'POST',
      /* text/plain avoids the CORS preflight that Apps Script cannot answer */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      signal: ctl.signal
    })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
      .then(function (res) {
        clearTimeout(timer);
        var body = null;
        try { body = JSON.parse(res.t); } catch (e) {}
        /* success only when the server actually says so */
        if (!res.ok || !body || body.ok !== true) {
          throw new Error((body && body.error) || 'The booking service did not accept the request.');
        }
        busy(false);
        finish(data, 'server');
      })
      .catch(function (err) {
        clearTimeout(timer);
        busy(false);
        fail.hidden = false;
        var wa = waLink(data);
        fail.innerHTML = '<b>That did not go through.</b> ' +
          esc(err && err.name === 'AbortError'
            ? 'The request timed out.'
            : (err && err.message) || 'Something went wrong.') +
          ' Nothing you typed has been lost — press <b>Request My Free Demo</b> to try again' +
          (wa
            ? '.<a class="bk-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' +
              WA_ICON + 'Send it on WhatsApp instead</a>'
            : ', or message us on WhatsApp.');
        fail.focus && fail.focus();
      });
  }

  /* ---------------------------------------------------------------
     DONE
     --------------------------------------------------------------- */
  function finish(d, mode, blocked) {
    var firstName = d.parent.split(/\s+/)[0] || d.parent;

    if (mode === 'server') {
      $('bkDoneH').innerHTML = 'Your next move is in motion! &#9823;';
      $('bkDoneP').textContent = 'Thanks, ' + firstName + '! We’ve received your demo request for ' +
        d.student + '. Our team will contact you to confirm a suitable time.';
    } else if (mode === 'whatsapp') {
      /* The parent still has to press send, so this must not claim we have it */
      $('bkDoneH').innerHTML = blocked
        ? 'One last tap, ' + esc(firstName) + ' &#9823;'
        : 'Almost there, ' + esc(firstName) + '! &#9823;';
      $('bkDoneP').textContent = blocked
        ? 'Your browser blocked the new tab. Press the button below to open WhatsApp with ' +
          d.student + '’s details already written out — then press send.'
        : 'We’ve opened WhatsApp with ' + d.student + '’s details already written out. ' +
          'Press send there and we’ll reply to confirm a time.';
    } else {
      $('bkDoneH').innerHTML = 'Preview only &mdash; nothing was sent';
      $('bkDoneP').textContent = 'No booking endpoint is connected, so this request was not ' +
        'stored or sent anywhere. Here is what would have been submitted.';
    }

    var rows = [
      ['Student', d.student + ', age ' + d.age],
      ['Experience', d.levelText],
      ['Class', d.formatText],
      ['Contact', d.dial + ' ' + d.phone],
      ['Email', d.email],
      ['City or area', d.city],
      ['Preferred day', d.day === 'No preference' ? '' : d.day],
      ['Preferred time', d.time === 'No preference' ? '' : d.time + ' · PKT'],
      ['Note to the coach', d.notes]
    ].filter(function (r) { return r[1]; });

    $('bkSummary').innerHTML = rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');

    /* On WhatsApp this is the way the booking actually gets to us, so it is
       the main action. After a real send to the server it would only be a
       duplicate, so it stays hidden. */
    var wa = $('bkWa'), href = (mode === 'whatsapp' || mode === 'preview') ? waLink(d) : '';
    wa.hidden = !href;
    if (href) {
      wa.href = href;
      wa.classList.toggle('is-key', mode === 'whatsapp');
      var label = wa.querySelector('span');
      if (label) label.textContent = mode === 'whatsapp'
        ? (blocked ? 'Open WhatsApp and send' : 'Open WhatsApp again')
        : 'Send it to us on WhatsApp';
    }

    form.hidden = true;
    foot.hidden = true;
    $('bkSteps').hidden = true;
    done.classList.add('on');
    done.focus();
  }

  $('bkFinish').addEventListener('click', close);

  /* ---------------------------------------------------------------
     OPEN / CLOSE, FOCUS AND THE KEYBOARD
     --------------------------------------------------------------- */
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* The success screen is a dead end until this runs: without it, the next
     visitor to press the button is shown the last person's confirmation. */
  function reset() {
    if (!done.classList.contains('on')) return;
    done.classList.remove('on');
    form.hidden = false;
    foot.hidden = false;
    $('bkSteps').hidden = false;
    fail.hidden = true;
    form.reset();
    root.querySelectorAll('.bk-card-opt.is-on').forEach(function (l) { l.classList.remove('is-on'); });
    ['parent', 'student', 'age', 'level', 'format', 'phone', 'email', 'consent']
      .forEach(function (f) { setErr(f, ''); });
    $('bkFormatHint').hidden = true;
    show(1, true);
  }

  function open(e) {
    if (e) e.preventDefault();
    lastFocus = (e && e.currentTarget) || document.activeElement;
    reset();
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      root.classList.add('is-open');
      var f = $('bkParent');
      if (f) setTimeout(function () { f.focus(); }, still ? 0 : 160);
    });
  }

  function close() {
    root.classList.remove('is-open');
    var after = function () {
      root.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    };
    if (still) after(); else setTimeout(after, 240);
  }

  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { e.preventDefault(); close(); }
  });

  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    /* the tab ring stays inside the dialog while it is up */
    var list = Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
      /* tabIndex < 0 excludes the honeypot, which is on-screen as far as the
         layout is concerned and would otherwise become the ring's last stop */
      if (el.tabIndex < 0) return false;
      return el.offsetParent !== null || el === document.activeElement;
    });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* every way into the form: the nav button, and the drawer's copy of it */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.nav-demo, [data-book-demo]');
    if (t) open({ preventDefault: function () { e.preventDefault(); }, currentTarget: t });
  });

  /* the button is a link to the tuition page when this script does not run;
     with it running, it opens the form instead */
  trigger.setAttribute('aria-haspopup', 'dialog');
})();
