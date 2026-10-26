'use strict';

// Receivables aging and CSV export helpers. Pure functions: no database or server imports.

const AGING_BUCKETS = [
  { key: 'current', label: 'Not yet due' },
  { key: 'd1_30', label: '1-30 days overdue' },
  { key: 'd31_60', label: '31-60 days overdue' },
  { key: 'd61_90', label: '61-90 days overdue' },
  { key: 'd90_plus', label: 'Over 90 days overdue' },
];

function dayNumber(isoDate) {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isFinite(time) ? Math.floor(time / 86400000) : null;
}

// Invoices with no due date ("payment due upon receipt") age from the day they were issued.
function invoiceDueDate(invoice) {
  const snapshot = invoice.invoiceSnapshot || {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(snapshot.dueDate || '')) return snapshot.dueDate;
  if (snapshot.issuedAt) return String(snapshot.issuedAt).slice(0, 10);
  return String(invoice.createdAt || '').slice(0, 10);
}

function bucketFor(daysOverdue) {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'd1_30';
  if (daysOverdue <= 60) return 'd31_60';
  if (daysOverdue <= 90) return 'd61_90';
  return 'd90_plus';
}

function emptyBuckets() {
  return Object.fromEntries(AGING_BUCKETS.map(bucket => [bucket.key, 0]));
}

// `invoices` are store invoices (with balanceKsh); `today` is YYYY-MM-DD in the business time zone.
function agingReport(invoices, today) {
  const todayDay = dayNumber(today);
  const totals = emptyBuckets();
  const customers = new Map();
  const rows = [];

  for (const invoice of invoices || []) {
    const balanceKsh = Number(invoice.balanceKsh || 0);
    if (!['issued', 'sent'].includes(invoice.status) || balanceKsh <= 0) continue;
    const dueDate = invoiceDueDate(invoice);
    const dueDay = dayNumber(dueDate);
    const daysOverdue = dueDay === null || todayDay === null ? 0 : todayDay - dueDay;
    const bucket = bucketFor(daysOverdue);
    totals[bucket] += balanceKsh;

    const customerName = invoice.invoiceSnapshot?.customerSnapshot?.name || 'Customer';
    const key = invoice.customerId || customerName;
    if (!customers.has(key)) customers.set(key, { customerId: invoice.customerId || '', customerName, total: 0, buckets: emptyBuckets() });
    const entry = customers.get(key);
    entry.total += balanceKsh;
    entry.buckets[bucket] += balanceKsh;

    rows.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, customerName, dueDate, daysOverdue: Math.max(0, daysOverdue), bucket, balanceKsh });
  }

  const totalOutstandingKsh = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return {
    asOf: today,
    buckets: AGING_BUCKETS,
    totals,
    totalOutstandingKsh,
    overdueKsh: totalOutstandingKsh - totals.current,
    customers: [...customers.values()].sort((a, b) => b.total - a.total),
    invoices: rows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balanceKsh - a.balanceKsh),
  };
}

// CSV cells that begin with a formula character are prefixed so spreadsheets treat them as text.
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns, rows) {
  const header = columns.map(column => csvCell(column.label)).join(',');
  const lines = rows.map(row => columns.map(column => csvCell(row[column.key])).join(','));
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}

const INVOICE_CSV_COLUMNS = [
  { key: 'invoiceNumber', label: 'Invoice number' },
  { key: 'customerName', label: 'Customer' },
  { key: 'quoteNumber', label: 'Quote number' },
  { key: 'status', label: 'Status' },
  { key: 'paymentStatus', label: 'Payment status' },
  { key: 'issuedAt', label: 'Issued on' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'amountKsh', label: 'Amount (KSh)' },
  { key: 'paidKsh', label: 'Paid (KSh)' },
  { key: 'balanceKsh', label: 'Balance (KSh)' },
];

const PAYMENT_CSV_COLUMNS = [
  { key: 'paymentDate', label: 'Payment date' },
  { key: 'invoiceNumber', label: 'Invoice number' },
  { key: 'customerName', label: 'Customer' },
  { key: 'amountKsh', label: 'Amount (KSh)' },
  { key: 'method', label: 'Method' },
  { key: 'reference', label: 'Reference' },
  { key: 'recordedBy', label: 'Recorded by' },
  { key: 'notes', label: 'Notes' },
];

function invoiceExportRows(invoices) {
  return (invoices || []).map(invoice => ({
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.invoiceSnapshot?.customerSnapshot?.name || '',
    quoteNumber: invoice.invoiceSnapshot?.quoteNumber || '',
    status: invoice.status,
    paymentStatus: invoice.paymentStatus || '',
    issuedAt: invoice.invoiceSnapshot?.issuedAt ? String(invoice.invoiceSnapshot.issuedAt).slice(0, 10) : '',
    dueDate: invoice.invoiceSnapshot?.dueDate || '',
    amountKsh: Number(invoice.amountKsh || 0),
    paidKsh: Number(invoice.paidAmountKsh || 0),
    balanceKsh: Number(invoice.balanceKsh || 0),
  }));
}

function paymentExportRows(payments, invoices) {
  const byId = new Map((invoices || []).map(invoice => [invoice.id, invoice]));
  return (payments || []).map(payment => {
    const invoice = byId.get(payment.invoiceId);
    return {
      paymentDate: payment.paymentDate,
      invoiceNumber: invoice?.invoiceNumber || '',
      customerName: invoice?.invoiceSnapshot?.customerSnapshot?.name || '',
      amountKsh: Number(payment.amountKsh || 0),
      method: payment.method,
      reference: payment.reference || '',
      recordedBy: payment.recordedBy || '',
      notes: payment.notes || '',
    };
  });
}

module.exports = {
  AGING_BUCKETS, agingReport, csvCell, toCsv,
  INVOICE_CSV_COLUMNS, PAYMENT_CSV_COLUMNS, invoiceExportRows, paymentExportRows,
};
