/* ================= REGISTRATION =================
   register.html — a student form and a member form behind two tabs.

   WHERE THE DATA GOES
   -------------------
   The same Google Apps Script as the demo form (tools/booking-endpoint.gs).
   Every registration carries form: 'register', and the script writes it to
   the "Students" or "Members" tab instead of the bookings tab. Paste the
   same /exec URL and token you put in assets/booking.js below.

   Registering does not create a login by itself — there is no server to
   hold one. The academy reads the row, confirms, and issues the account.

   Until ENDPOINT is filled in, the form says so and calls itself a preview.
   ========================================================== */
(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbypD02QDMeGs4uQlI9fk64rl8AvJKXG-wMd4cF8rSILJRrXNcKD9Afi6hp-NWAZnmX2/exec';          // same URL as ENDPOINT in assets/booking.js
  var TOKEN    = 'nexus_uWWd9Zad2co7MZ0lqkRbktYV';   // same as SHARED_TOKEN in the Apps Script
  var TIMEOUT_MS = 15000;

  var $ = function (id) { return document.getElementById(id); };
  var studentForm = $('rgStudent'), memberForm = $('rgMember');
  if (!studentForm || !memberForm) return;

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---- country codes: Pakistan first, then the ones most likely here ---- */
  var DIALS = [
    ['+92', 'Pakistan'], ['+91', 'India'], ['+971', 'UAE'], ['+966', 'Saudi Arabia'],
    ['+44', 'United Kingdom'], ['+1', 'USA / Canada'], ['+61', 'Australia'],
    ['+974', 'Qatar'], ['+973', 'Bahrain'], ['+968', 'Oman'], ['+965', 'Kuwait'],
    ['+60', 'Malaysia'], ['+65', 'Singapore'], ['+90', 'Türkiye'], ['+49', 'Germany'],
    ['+33', 'France'], ['+353', 'Ireland'], ['+27', 'South Africa'],
    ['+880', 'Bangladesh'], ['+94', 'Sri Lanka'], ['+86', 'China'], ['+64', 'New Zealand']
  ];

  var TICK = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
  var CARDS = {
    level: [
      ['new',     'New to chess',        'Has never really played',
        '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/></svg>'],
      ['basics',  'Know the basics',     'Knows how the pieces move',
        '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'],
      ['regular', 'Play regularly',      'Plays games, maybe online',
        '<svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>']
    ],
    format: [
      ['online',  'Online',          'Video call, board on screen',
        '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'],
      ['home',    'At home',         'A coach comes to you',
        '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>'],
      ['academy', 'At the academy',  'In person, in a group',
        '<svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-5h6v5"/><path d="M9 11h2M13 11h2"/></svg>']
    ]
  };
  function cardText(kind, value) {
    var hit = CARDS[kind].filter(function (x) { return x[0] === value; })[0];
    return hit ? hit[1] : '';
  }

  /* ---- fill the country selects and the option cards ---- */
  document.querySelectorAll('[data-dial]').forEach(function (sel) {
    sel.innerHTML = DIALS.map(function (d) {
      return '<option value="' + d[0] + '"' + (d[0] === '+92' ? ' selected' : '') +
        ' title="' + esc(d[1]) + '">' + d[0] + '</option>';
    }).join('');
  });
  document.querySelectorAll('[data-cards]').forEach(function (box) {
    var kind = box.getAttribute('data-cards');
    var name = box.closest('form').dataset.kind + '-' + kind;
    box.innerHTML = CARDS[kind].map(function (x) {
      return '<label class="bk-card-opt">' +
        '<input type="radio" name="' + name + '" value="' + x[0] + '">' +
        '<span class="ic">' + x[3] + '</span>' +
        '<span class="tx"><span class="tt">' + x[1] + '</span>' +
        '<span class="td">' + x[2] + '</span></span>' +
        '<span class="tick">' + TICK + '</span>' +
      '</label>';
    }).join('');
  });

  var live = !!ENDPOINT;
  document.querySelectorAll('[data-preview]').forEach(function (p) { p.hidden = live; });

  /* ---------------------------------------------------------------
     TABS — #student / #member in the address bar opens the right one
     --------------------------------------------------------------- */
  var tabs = { student: $('tabStudent'), member: $('tabMember') };
  var panes = { student: studentForm, member: memberForm };

  function select(which, focusTab) {
    Object.keys(tabs).forEach(function (k) {
      var on = k === which;
      tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[k].tabIndex = on ? 0 : -1;
      panes[k].hidden = !on;
    });
    if (focusTab) tabs[which].focus();
    if (history.replaceState) history.replaceState(null, '', '#' + which);
  }
  tabs.student.addEventListener('click', function () { select('student'); });
  tabs.member.addEventListener('click', function () { select('member'); });
  document.querySelector('.rg-tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    var now = tabs.student.getAttribute('aria-selected') === 'true' ? 'student' : 'member';
    var next = e.key === 'Home' ? 'student' : e.key === 'End' ? 'member'
             : (now === 'student' ? 'member' : 'student');
    select(next, true);
  });
  var link = document.querySelector('[data-go-student]');
  if (link) link.addEventListener('click', function (e) {
    e.preventDefault(); select('student', true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  if (location.hash === '#member') select('member');
  window.addEventListener('hashchange', function () {
    if (location.hash === '#member' || location.hash === '#student') select(location.hash.slice(1));
  });

  /* ---------------------------------------------------------------
     VALIDATION — every message names the field and says what to do
     --------------------------------------------------------------- */
  function setErr(form, f, msg) {
    var wrap = form.querySelector('[data-f="' + f + '"]');
    if (!wrap) return;
    wrap.classList.toggle('bad', !!msg);
    var p = wrap.querySelector('.bk-err');
    if (p) p.textContent = msg || '';
    wrap.querySelectorAll('input:not([type=radio]), select, textarea').forEach(function (i) {
      i.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
  }
  function val(id) { return ($(id).value || '').trim(); }
  function picked(form, kind) {
    var el = form.querySelector('input[name="' + form.dataset.kind + '-' + kind + '"]:checked');
    return el ? el.value : '';
  }
  function phoneOk(digits) { return digits.length >= 7 && digits.length <= 15; }

  /* each rule: [field, element to focus, message or '' when fine] */
  function rulesStudent() {
    var age = parseInt(val('sAge'), 10);
    var digits = val('sPhone').replace(/\D/g, '');
    var email = val('sEmail');
    return [
      ['sName', 'sName', val('sName') ? '' : 'Please add the student’s name.'],
      ['sAge', 'sAge', !val('sAge') ? 'Age is needed.'
        : (isNaN(age) || age < 3 || age > 19) ? 'Students are 3 to 19. Over 19? Register as a member.' : ''],
      ['sLevel', null, picked(studentForm, 'level') ? '' : 'Pick the one that sounds most like them.'],
      ['sFormat', null, picked(studentForm, 'format') ? '' : 'Choose how they would like to learn.'],
      ['sParent', 'sParent', val('sParent') ? '' : 'Please tell us your name.'],
      ['sEmail', 'sEmail', !email ? 'An email is needed to send the login.'
        : EMAIL_RE.test(email) ? '' : 'Check the email address.'],
      ['sPhone', 'sPhone', !digits ? 'A number lets us confirm the class with you.'
        : phoneOk(digits) ? '' : 'That does not look like a complete number.'],
      ['sConsent', 'sConsent', $('sConsent').checked ? '' : 'We need a parent or guardian’s permission.']
    ];
  }
  function rulesMember() {
    var digits = val('mPhone').replace(/\D/g, '');
    var email = val('mEmail');
    return [
      ['mName', 'mName', val('mName') ? '' : 'Please tell us your name.'],
      ['mEmail', 'mEmail', !email ? 'An email is needed to send your login.'
        : EMAIL_RE.test(email) ? '' : 'Check the email address.'],
      ['mPhone', 'mPhone', !digits || phoneOk(digits) ? '' : 'Check the number, or leave it blank.'],
      ['mLevel', null, picked(memberForm, 'level') ? '' : 'Pick the one closest to you.'],
      ['mAdult', 'mAdult', $('mAdult').checked ? '' : 'Membership is for over-18s. Under 18? Use the Student tab.'],
      ['mConsent', 'mConsent', $('mConsent').checked ? '' : 'We need your permission before we get in touch.']
    ];
  }

  function check(form) {
    var rules = form === studentForm ? rulesStudent() : rulesMember();
    var first = null;
    rules.forEach(function (r) {
      setErr(form, r[0], r[2]);
      if (r[2] && !first) {
        first = r[1] ? $(r[1])
          : form.querySelector('[data-f="' + r[0] + '"] input');
      }
    });
    if (first) first.focus();
    return !first;
  }

  [studentForm, memberForm].forEach(function (form) {
    /* an error clears as soon as it is being corrected */
    form.addEventListener('input', function (e) {
      var wrap = e.target.closest('[data-f]');
      if (wrap && wrap.classList.contains('bad')) setErr(form, wrap.dataset.f, '');
    });
    form.addEventListener('change', function (e) {
      var wrap = e.target.closest('[data-f]');
      if (wrap && wrap.classList.contains('bad')) setErr(form, wrap.dataset.f, '');
      /* a visible state for engines without :has() */
      var group = e.target.closest('.bk-cards');
      if (group) group.querySelectorAll('.bk-card-opt').forEach(function (l) {
        l.classList.toggle('is-on', l.contains(e.target) && e.target.checked);
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.dataset.busy) return;
      if (check(form)) send(form);
    });
  });

  /* ---------------------------------------------------------------
     SENDING
     --------------------------------------------------------------- */
  function payload(form) {
    var base = {
      token: TOKEN, form: 'register', type: form.dataset.kind,
      page: location.pathname, submittedAt: new Date().toISOString()
    };
    if (form === studentForm) {
      var lv = picked(studentForm, 'level'), fm = picked(studentForm, 'format');
      return Object.assign(base, {
        student: val('sName'), age: val('sAge'), school: val('sSchool'),
        level: lv, levelText: cardText('level', lv),
        format: fm, formatText: cardText('format', fm),
        parent: val('sParent'), email: val('sEmail'),
        dial: $('sDial').value, phone: val('sPhone'),
        city: val('sCity'), notes: val('sNotes'),
        consent: 'yes', company: val('sCompany')
      });
    }
    var ml = picked(memberForm, 'level');
    var interests = Array.prototype.map.call(
      memberForm.querySelectorAll('input[name="interest"]:checked'),
      function (i) { return i.value; });
    return Object.assign(base, {
      name: val('mName'), email: val('mEmail'),
      dial: val('mPhone') ? $('mDial').value : '', phone: val('mPhone'),
      level: ml, levelText: cardText('level', ml),
      rating: val('mRating'), city: val('mCity'),
      interests: interests.join(', '),
      adult: 'yes', consent: 'yes', company: val('mCompany')
    });
  }

  function busy(form, on) {
    var btn = form.querySelector('.bk-go'), label = form.querySelector('[data-label]');
    if (on) { form.dataset.busy = '1'; label.dataset.idle = label.innerHTML; label.innerHTML = 'Sending&hellip;'; }
    else { delete form.dataset.busy; if (label.dataset.idle) label.innerHTML = label.dataset.idle; }
    btn.classList.toggle('is-busy', on);
    btn.disabled = on;
  }

  function send(form) {
    var data = payload(form);
    var fail = form.querySelector('[data-fail]');
    fail.hidden = true;
    busy(form, true);

    if (!live) {
      setTimeout(function () { busy(form, false); finish(data, false); }, 450);
      return;
    }

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
        if (!res.ok || !body || body.ok !== true) {
          throw new Error((body && body.error) || 'The registration service did not accept the request.');
        }
        busy(form, false);
        finish(data, true);
      })
      .catch(function (err) {
        clearTimeout(timer);
        busy(form, false);
        fail.hidden = false;
        fail.innerHTML = '<b>That did not go through.</b> ' +
          esc(err && err.name === 'AbortError' ? 'The request timed out.'
            : (err && err.message) || 'Something went wrong.') +
          ' Nothing you typed has been lost &mdash; press the button to try again.';
        fail.focus();
      });
  }

  /* ---------------------------------------------------------------
     DONE
     --------------------------------------------------------------- */
  function finish(d, sent) {
    var student = d.type === 'student';
    var who = (student ? d.parent : d.name).split(/\s+/)[0];

    if (sent) {
      $('rgDoneH').innerHTML = student ? 'Welcome to Nexus, ' + esc(d.student.split(/\s+/)[0]) + '! &#9823;'
                                       : 'Welcome aboard, ' + esc(who) + '! &#9823;';
      $('rgDoneP').textContent = 'Thanks, ' + who + '. We’ve received your registration. ' +
        'Our team will confirm the details and email the login to ' + d.email + '.';
    } else {
      $('rgDoneH').innerHTML = 'Preview only &mdash; nothing was sent';
      $('rgDoneP').textContent = 'No registration endpoint is connected, so this was not stored ' +
        'or sent anywhere. Here is what would have been submitted.';
    }

    var rows = student ? [
      ['Student', d.student + ', age ' + d.age],
      ['School', d.school],
      ['Experience', d.levelText],
      ['Learning', d.formatText],
      ['Parent', d.parent],
      ['Email', d.email],
      ['Phone', d.dial + ' ' + d.phone],
      ['City or area', d.city],
      ['Note to the coach', d.notes]
    ] : [
      ['Name', d.name],
      ['Email', d.email],
      ['Phone', d.phone ? d.dial + ' ' + d.phone : ''],
      ['Experience', d.levelText],
      ['Rating', d.rating],
      ['City', d.city],
      ['Interests', d.interests]
    ];
    $('rgSummary').innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');

    studentForm.hidden = true;
    memberForm.hidden = true;
    document.querySelector('.rg-tabs').hidden = true;
    var done = $('rgDone');
    done.classList.add('on');
    done.scrollIntoView({ block: 'start', behavior: 'smooth' });
    done.focus({ preventScroll: true });
  }
})();
