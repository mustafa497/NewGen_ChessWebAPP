/**
 * Nexus Chess Academy — demo-class booking endpoint
 * =================================================
 * Receives a booking from assets/booking.js and appends a row to the sheet.
 *
 * HOW TO DEPLOY
 * -------------
 *  1. Open the spreadsheet:
 *       https://docs.google.com/spreadsheets/d/1GEbjh4zsW4RzNj9ugdn_1EDhe8-coo8OMI3nFwK8uRg/edit
 *  2. Extensions -> Apps Script. Delete whatever is in Code.gs and paste this file.
 *  3. Change SHARED_TOKEN below to a long random string of your own.
 *  4. Save, then Deploy -> New deployment -> type "Web app".
 *       Execute as:        Me
 *       Who has access:    Anyone
 *     "Anyone" is required — the visitor's browser is not signed in to Google.
 *     The token below is what stops strangers writing rows.
 *  5. Copy the /exec URL it gives you.
 *  6. In assets/booking.js set:
 *       var ENDPOINT = 'https://script.google.com/macros/s/..../exec';
 *       var TOKEN    = 'the same SHARED_TOKEN you set here';
 *  7. Re-upload assets/booking.js to the host. Send one test booking and check
 *     the row appears on the tab named in SHEET_NAME below.
 *
 * WHEN YOU EDIT THIS LATER
 * ------------------------
 * Deploy -> Manage deployments -> edit the existing one -> New version.
 * Creating a *new* deployment gives a new URL and the old one goes stale.
 *
 * A NOTE ON WHAT IS BEING STORED
 * ------------------------------
 * These rows hold a child's first name and age and a parent's phone number.
 * Keep the spreadsheet shared with the people who need it and no one else.
 */

/* ---- change this ---- */
var SHARED_TOKEN = 'nexus_uWWd9Zad2co7MZ0lqkRbktYV';

/* the tab the rows go on. It must already exist, or it is created. */
var SHEET_NAME = 'Sheet1';

var HEADERS = [
  'Received', 'Parent', 'Student', 'Age', 'Experience',
  'Class', 'Phone', 'Email', 'City / area', 'Preferred day', 'Preferred time',
  'Notes', 'Consent', 'Page'
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return reply(400, 'Empty request.');

    var d;
    try { d = JSON.parse(e.postData.contents); }
    catch (err) { return reply(400, 'Could not read the request.'); }

    if (String(d.token || '') !== SHARED_TOKEN) return reply(403, 'Not authorised.');

    /* a bot that fills every field gives itself away in the hidden one */
    if (String(d.company || '').trim() !== '') return reply(200, null, true);

    /* ---- the same rules the browser applies, applied again here ---- */
    var parent  = clean(d.parent, 80);
    var student = clean(d.student, 60);
    var ageRaw  = String(d.age || '').trim();
    var age     = parseInt(ageRaw, 10);
    var phone   = clean(d.phone, 20);
    var digits  = phone.replace(/[^0-9]/g, '');
    var email   = clean(d.email, 120);
    var consent = String(d.consent || '') === 'yes';

    if (!parent)  return reply(422, 'A parent or guardian name is required.');
    if (!student) return reply(422, 'A student first name is required.');
    if (!ageRaw || isNaN(age) || age < 3 || age > 19) return reply(422, 'Age must be between 3 and 19.');
    if (!digits || digits.length < 7 || digits.length > 15) return reply(422, 'A valid phone number is required.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reply(422, 'That email address is not valid.');
    if (!consent) return reply(422, 'Consent to be contacted is required.');

    var LEVELS = { 'new': 'New to chess', 'basics': 'Know the basics', 'regular': 'Already plays regularly' };
    var level = LEVELS[String(d.level || '')] || '';
    if (!level) return reply(422, 'Please choose a chess experience level.');

    var FORMATS = { 'online': 'Online', 'home': 'At your home', 'academy': 'At the academy' };
    var format = FORMATS[String(d.format || '')] || '';
    if (!format) return reply(422, 'Please choose how the class should run.');

    var dial = clean(d.dial, 6) || '+92';
    if (!/^\+\d{1,4}$/.test(dial)) dial = '+92';

    var row = [
      new Date(),
      parent,
      student,
      age,
      level,
      format,
      "'" + dial + ' ' + phone,          // leading quote keeps Sheets from eating the +
      email,
      clean(d.city, 80),
      passthrough(d.day, 20),
      passthrough(d.time, 40),
      clean(d.notes, 500),
      'yes',
      clean(d.page, 120)
    ];

    /* one writer at a time, so two parents submitting together cannot
       land on the same row */
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = book();

      /* the same person pressing twice should not create two rows. Compare
         against what is actually stored, which includes the dial code. */
      var storedDigits = (dial + phone).replace(/[^0-9]/g, '');
      if (isDuplicate(sheet, parent, student, storedDigits)) return reply(200, null, true);

      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return reply(200, null, true);

  } catch (err) {
    return reply(500, 'The booking could not be saved. ' + (err && err.message ? err.message : ''));
  }
}

/** A plain GET is someone opening the URL in a browser; say what it is. */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: 'This endpoint only accepts bookings by POST.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------- */

function book() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    /* empty tab: lay the header down */
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  /* Row 1 is only rewritten when it is already ours - widening it after new
     columns were added. Anything else in this tab is left alone rather than
     overwritten, because SHEET_NAME points at a tab you may also use. */
  var first = String(sheet.getRange(1, 1).getValue() || '').trim();
  if (first === HEADERS[0] && sheet.getLastColumn() < HEADERS.length) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  }
  return sheet;
}

/** The same parent, student and number inside five minutes is a double press. */
function isDuplicate(sheet, parent, student, digits) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var from = Math.max(2, last - 24);                 // only the recent tail
  var rows = sheet.getRange(from, 1, last - from + 1, 8).getValues();
  var cutoff = Date.now() - 5 * 60 * 1000;
  for (var i = 0; i < rows.length; i++) {
    var when = rows[i][0];
    if (!(when instanceof Date) || when.getTime() < cutoff) continue;
    /* column 7 is Phone — keep this in step with HEADERS */
    var sameDigits = String(rows[i][6] || '').replace(/[^0-9]/g, '') === digits;
    if (String(rows[i][1]) === parent && String(rows[i][2]) === student && sameDigits) return true;
  }
  return false;
}

function clean(v, max) {

  /* strip control characters, keep everything a real name might contain */

  return String(v == null ? '' : v).replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max);

}

/** Day and time come from fixed lists, so only their length needs guarding. */
function passthrough(v, max) {
  var s = clean(v, max);
  return s === 'No preference' ? '' : s;
}

function reply(status, error, ok) {
  return ContentService
    .createTextOutput(JSON.stringify(ok ? { ok: true } : { ok: false, status: status, error: error }))
    .setMimeType(ContentService.MimeType.JSON);
}
