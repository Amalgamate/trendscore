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

function invoicePdfBuffer(invoice) {
  const snapshot = invoice.invoiceSnapshot || {};
  const customer = snapshot.customerSnapshot || {};
  const quote = snapshot.quoteSnapshot || {};
  const items = Array.isArray(quote.lines) ? quote.lines : [];
  const navy = '0.055 0.12 0.34';
  const ink = '0.12 0.17 0.25';
  const muted = '0.36 0.42 0.51';
  const teal = '0.02 0.57 0.52';
  const pale = '0.93 0.96 0.98';
  const rule = '0.84 0.88 0.92';
  const pages = [];
  let commands = [];
  let cursor = 0;
  const money = value => `KSh ${Number(value || 0).toLocaleString('en-KE')}`;
  const safe = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const text = (x, y, value, size = 10, color = ink, font = 'F1', align = 'left') => {
    const content = safe(value);
    const approxWidth = content.length * size * (font === 'F2' ? 0.56 : 0.5);
    const left = align === 'right' ? x - approxWidth : align === 'center' ? x - approxWidth / 2 : x;
    commands.push(`BT /${font} ${size} Tf ${color} rg ${left.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(content)}) Tj ET`);
  };
  const rect = (x, y, width, height, color) => commands.push(`q ${color} rg ${x} ${y} ${width} ${height} re f Q`);
  const stroke = (x1, y1, x2, y2, color = rule, width = 0.7) => commands.push(`q ${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
  const wrap = (value, max = 58) => {
    const words = safe(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= max) line += ` ${word}`;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const beginPage = (first = false) => {
    commands = [];
    if (first) {
      rect(0, 738, 612, 104, navy);
      rect(42, 772, 42, 42, teal);
      text(63, 786, 'TC', 17, '1 1 1', 'F2', 'center');
      text(98, 798, 'TRENDSCORE', 18, '1 1 1', 'F2');
      text(99, 779, 'SCHOOL MANAGEMENT PLATFORM', 8, '0.76 0.83 0.91', 'F2');
      text(570, 805, 'INVOICE', 10, '0.76 0.83 0.91', 'F2', 'right');
      rect(468, 769, 102, 23, '1 1 1');
      text(519, 777, 'DRAFT', 10, navy, 'F2', 'center');
      text(42, 718, 'PREVIEW ONLY - NOT FOR PAYMENT', 8, teal, 'F2');
      text(42, 689, invoice.invoiceNumber || 'Draft invoice', 17, navy, 'F2');
      text(570, 696, `Created ${String(invoice.createdAt || '').slice(0, 10) || 'Date pending'}`, 9, muted, 'F1', 'right');

      rect(42, 570, 326, 96, pale);
      rect(382, 570, 188, 96, pale);
      text(56, 647, 'BILL TO', 8, teal, 'F2');
      text(56, 628, customer.legalName || customer.name || 'Customer', 12, navy, 'F2');
      let billY = 610;
      for (const detail of [customer.billingAddress, customer.billingEmail, customer.billingPhone, customer.taxIdentifier ? `Tax ID: ${customer.taxIdentifier}` : '']) {
        if (detail) { text(56, billY, detail, 8.5, muted); billY -= 12; }
      }
      text(396, 647, 'INVOICE DETAILS', 8, teal, 'F2');
      text(396, 628, 'Status', 8, muted);
      text(554, 628, 'Draft', 9, navy, 'F2', 'right');
      text(396, 609, 'Source quote', 8, muted);
      text(554, 609, snapshot.quoteNumber || '-', 8.5, navy, 'F2', 'right');
      text(396, 590, 'Terms / due date', 8, muted);
      text(554, 590, 'Set before issue', 8, navy, 'F2', 'right');
      text(42, 548, `Enrollment snapshot: ${Number(snapshot.enrollmentCount || quote.enrollmentCount || 0).toLocaleString('en-KE')} students`, 8.5, muted);
      text(570, 548, safe(quote.billingCadenceLabel || ''), 8.5, muted, 'F1', 'right');
      cursor = 522;
    } else {
      rect(0, 774, 612, 68, navy);
      text(42, 808, 'TRENDSCORE', 16, '1 1 1', 'F2');
      text(42, 787, `${invoice.invoiceNumber || 'Draft invoice'} - CONTINUED`, 9, '0.76 0.83 0.91');
      text(570, 807, 'DRAFT', 10, '1 1 1', 'F2', 'right');
      cursor = 744;
    }
    pages.push(null);
  };
  const drawTableHeader = () => {
    rect(42, cursor - 24, 528, 24, navy);
    text(53, cursor - 16, 'DESCRIPTION', 7.5, '1 1 1', 'F2');
    text(385, cursor - 16, 'QTY', 7.5, '1 1 1', 'F2', 'right');
    text(468, cursor - 16, 'UNIT PRICE', 7.5, '1 1 1', 'F2', 'right');
    text(558, cursor - 16, 'AMOUNT', 7.5, '1 1 1', 'F2', 'right');
    cursor -= 24;
  };
  const finishPage = () => {
    stroke(42, 54, 570, 54);
    text(42, 38, 'DRAFT - NOT A TAX INVOICE', 7.5, muted, 'F2');
    text(570, 38, `TrendSCORE billing | Page ${pages.length}`, 7.5, muted, 'F1', 'right');
    pages[pages.length - 1] = commands.join('\n');
  };

  beginPage(true);
  drawTableHeader();
  items.forEach((item, index) => {
    const descriptionLines = wrap(item.description || 'Service', 55);
    const rowHeight = Math.max(34, descriptionLines.length * 12 + 16);
    if (cursor - rowHeight < 142) {
      finishPage();
      beginPage(false);
      drawTableHeader();
    }
    if (index % 2 === 1) rect(42, cursor - rowHeight, 528, rowHeight, '0.975 0.982 0.988');
    descriptionLines.forEach((line, lineIndex) => text(53, cursor - 17 - (lineIndex * 12), line, 8.5, ink));
    text(385, cursor - 17, Number(item.quantity || 0).toLocaleString('en-KE'), 8.5, ink, 'F1', 'right');
    text(468, cursor - 17, money(item.unitPriceKsh), 8.5, ink, 'F1', 'right');
    text(558, cursor - 17, money(item.amountKsh), 8.5, navy, 'F2', 'right');
    stroke(42, cursor - rowHeight, 570, cursor - rowHeight, rule, 0.45);
    cursor -= rowHeight;
  });
  if (cursor < 230) {
    finishPage();
    beginPage(false);
  }

  const summaryTop = cursor - 8;
  const total = Number(invoice.amountKsh || 0);
  text(354, summaryTop, 'Subtotal', 9, muted);
  text(558, summaryTop, money(total), 9, ink, 'F2', 'right');
  text(354, summaryTop - 18, 'Tax', 9, muted);
  text(558, summaryTop - 18, 'Not included', 8.5, muted, 'F1', 'right');
  stroke(354, summaryTop - 29, 570, summaryTop - 29, rule, 0.8);
  rect(344, summaryTop - 70, 226, 32, pale);
  text(356, summaryTop - 58, 'TOTAL', 9, navy, 'F2');
  text(558, summaryTop - 60, money(total), 14, navy, 'F2', 'right');

  const noteY = summaryTop - 95;
  text(42, noteY, 'BEFORE THIS INVOICE IS ISSUED', 8, teal, 'F2');
  const disclaimer = snapshot.taxNote || 'Tax treatment, payment terms, and seller details must be confirmed before issue.';
  wrap(disclaimer, 92).slice(0, 2).forEach((line, index) => text(42, noteY - 14 - (index * 12), line, 8, muted));
  text(42, noteY - 46, `Prepared from accepted quote ${snapshot.quoteNumber || ''}. Amounts and line items reflect that quote snapshot.`, 8, muted);
  text(42, noteY - 61, 'This draft is for review only. It is not an issued invoice or a tax invoice.', 8, navy, 'F2');
  finishPage();

  const objects = [null];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const fontRegularId = 3 + pages.length * 2;
  const fontBoldId = fontRegularId + 1;
  const kids = pages.map((_page, index) => `${3 + index * 2} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  pages.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
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

module.exports = { createPdfBuffer, quotePdfLines, invoicePdfBuffer };
