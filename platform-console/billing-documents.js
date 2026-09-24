'use strict';

function pdfText(value) {
  const plain = String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/₦/g, 'NGN ')
    .replace(/KSh/gi, 'KSh')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
  return plain.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createPdfBuffer(lines) {
  const pages = [];
  for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48));
  if (!pages.length) pages.push(['Quote']);

  const objects = [null];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = pages.map((_page, index) => `${3 + index * 2} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  pages.forEach((page, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const stream = page.map((line, row) => `BT /F1 ${row === 0 && index === 0 ? 16 : 10} Tf 42 ${790 - row * 15} Td (${pdfText(line)}) Tj ET`).join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });
  const fontId = 3 + pages.length * 2;
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(output, 'ascii');
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output, 'ascii');
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, 'ascii');
}

function quotePdfLines(quote) {
  const customer = quote.customerSnapshot || {};
  const snapshot = quote.quoteSnapshot || {};
  const money = value => `KSh ${Number(value || 0).toLocaleString('en-KE')}`;
  const lines = [
    'TrendSCORE - SCHOOL SERVICE QUOTATION',
    '',
    `Quote: ${quote.quoteNumber}`,
    `Date: ${String(quote.createdAt || '').slice(0, 10)}`,
    `Valid until: ${quote.expiresOn || 'As agreed'}`,
    `Customer: ${customer.name || ''}`,
    `Legal name: ${customer.legalName || customer.name || ''}`,
    `School / tenant: ${customer.tenantKey || 'Not linked'}`,
    `Billing email: ${customer.billingEmail || 'Not provided'}`,
    `Billing address: ${customer.billingAddress || 'Not provided'}`,
    `Tax identifier: ${customer.taxIdentifier || 'Not provided'}`,
    '',
    `Enrollment snapshot: ${quote.enrollmentCount} students`,
    `Student pricing: ${snapshot.pricingDescription || ''}`,
    `Billing cadence: ${snapshot.billingCadenceLabel || quote.billingCadence}`,
    '',
    'QUOTED ITEMS',
  ];
  for (const item of snapshot.lines || []) lines.push(`${item.description} | ${item.quantity} x ${money(item.unitPriceKsh)} = ${money(item.amountKsh)}`);
  lines.push('', `TOTAL QUOTED: ${money(quote.subtotalKsh)}`, '', snapshot.taxNote || 'Tax treatment is not included in this quotation.', 'This quotation is subject to the terms and validity date above.', 'This quotation is not a tax invoice.');
  if (quote.notes) lines.push('', `Notes: ${quote.notes}`);
  return lines.flatMap(line => String(line).split(/\r?\n/).flatMap(plain => {
    if (plain.length <= 86) return [plain];
    const wrapped = [];
    let remainder = plain;
    while (remainder.length > 86) {
      let splitAt = remainder.lastIndexOf(' ', 86);
      if (splitAt < 30) splitAt = 86;
      wrapped.push(remainder.slice(0, splitAt));
      remainder = `  ${remainder.slice(splitAt).trimStart()}`;
    }
    wrapped.push(remainder);
    return wrapped;
  }));
}

module.exports = { createPdfBuffer, quotePdfLines };
