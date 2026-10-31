'use strict';
// L2C-1-12 — Term calendar service.

function rowToTerm(row) {
  if (!row) return null;
  return {
    id: row.id,
    year: row.year,
    term: row.term,
    startDate: row.start_date,
    endDate: row.end_date,
    billingDate: row.billing_date,
    dueDate: row.due_date,
  };
}

/**
 * Returns the term that contains today's date, or null if today is between terms.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{id,year,term,startDate,endDate,billingDate,dueDate}|null}
 */
function getCurrentTerm(db) {
  const today = new Date().toISOString().slice(0, 10);
  return rowToTerm(
    db.prepare(
      `SELECT * FROM term_calendar
       WHERE start_date <= ? AND end_date >= ?
       ORDER BY year DESC, term DESC LIMIT 1`
    ).get(today, today)
  );
}

/**
 * Returns the term that contains the given date string (YYYY-MM-DD), or null.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} dateStr — YYYY-MM-DD
 * @returns {{id,year,term,startDate,endDate,billingDate,dueDate}|null}
 */
function getTermForDate(db, dateStr) {
  return rowToTerm(
    db.prepare(
      `SELECT * FROM term_calendar
       WHERE start_date <= ? AND end_date >= ?
       ORDER BY year DESC, term DESC LIMIT 1`
    ).get(dateStr, dateStr)
  );
}

/**
 * Returns all term rows ordered chronologically.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {Array}
 */
function listTerms(db) {
  return db.prepare('SELECT * FROM term_calendar ORDER BY year, term').all().map(rowToTerm);
}

/**
 * Upserts a term row (insert or update by year+term).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{year,term,startDate,endDate,billingDate,dueDate}} param
 */
function upsertTerm(db, { year, term, startDate, endDate, billingDate, dueDate }) {
  db.prepare(
    `INSERT INTO term_calendar (year, term, start_date, end_date, billing_date, due_date)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(year, term) DO UPDATE SET
       start_date   = excluded.start_date,
       end_date     = excluded.end_date,
       billing_date = excluded.billing_date,
       due_date     = excluded.due_date`
  ).run(year, term, startDate, endDate, billingDate, dueDate);
}

module.exports = { getCurrentTerm, getTermForDate, listTerms, upsertTerm };
