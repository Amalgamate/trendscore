'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function pdfText(value) {
  const plain = String(value ?? '').replace(/[–—]/g, '-').replace(/₦/g, 'NGN ')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
  return plain.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createPdf(objects) {
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(output, 'ascii');
    const body = objects[index];
    if (Buffer.isBuffer(body)) output += `${index} 0 obj\n${body.toString('binary')}\nendobj\n`;
    else output += `${index} 0 obj\n${body}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output, 'binary');
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, 'binary');
}

function pdfStream(dictionary, bytes) {
  return Buffer.concat([Buffer.from(`${dictionary}\nstream\n`, 'ascii'), bytes, Buffer.from('\nendstream', 'ascii')]);
}

function decodeLogoPng(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('Shared brand mark must be a PNG image');
  let width = 0; let height = 0; let colorType = 0; let bitDepth = 0; const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset); const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error('Shared brand mark must use 8-bit RGB or RGBA PNG');
  const channels = colorType === 6 ? 4 : 3; const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat)); const pixels = Buffer.alloc(height * stride); let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[sourceOffset++]; const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[sourceOffset++]; const left = x >= channels ? pixels[rowOffset + x - channels] : 0;
      const above = y ? pixels[rowOffset + x - stride] : 0; const upperLeft = y && x >= channels ? pixels[rowOffset + x - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const p = left + above - upperLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - above); const pc = Math.abs(p - upperLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
      } else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
      pixels[rowOffset + x] = (encoded + predictor) & 255;
    }
  }
  const targetWidth = Math.min(width, 1200); const targetHeight = Math.max(1, Math.round(height * targetWidth / width));
  const rgb = Buffer.alloc(targetWidth * targetHeight * 3); const alpha = colorType === 6 ? Buffer.alloc(targetWidth * targetHeight) : null;
  for (let y = 0; y < targetHeight; y += 1) for (let x = 0; x < targetWidth; x += 1) {
    const sx = Math.min(width - 1, Math.floor(x * width / targetWidth)); const sy = Math.min(height - 1, Math.floor(y * height / targetHeight));
    const source = (sy * width + sx) * channels; const target = (y * targetWidth + x) * 3;
    rgb[target] = pixels[source]; rgb[target + 1] = pixels[source + 1]; rgb[target + 2] = pixels[source + 2];
    if (alpha) alpha[y * targetWidth + x] = pixels[source + 3];
  }
  return { width: targetWidth, height: targetHeight, rgb: zlib.deflateSync(rgb), alpha: alpha && zlib.deflateSync(alpha) };
}

let cachedLogo;
function brandLogo() {
  if (cachedLogo) return cachedLogo;
  const candidates = [path.join(__dirname, 'public', 'TrendsCORE-Logo.png'), path.join(__dirname, '..', 'public', 'splash', 'new', 'TrendsCORE-Logo.png')];
  const logoPath = candidates.find(candidate => fs.existsSync(candidate));
  if (!logoPath) return null;
  cachedLogo = decodeLogoPng(logoPath);
  return cachedLogo;
}

function logoObjects(objects, firstObjectId) {
  const logo = brandLogo();
  if (!logo) return null;
  const maskId = logo.alpha ? firstObjectId : null; const imageId = firstObjectId + (logo.alpha ? 1 : 0);
  if (maskId) objects[maskId] = pdfStream(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.alpha.length} >>`, logo.alpha);
  const mask = maskId ? ` /SMask ${maskId} 0 R` : '';
  objects[imageId] = pdfStream(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.rgb.length}${mask} >>`, logo.rgb);
  return { imageId, nextId: imageId + 1, width: logo.width, height: logo.height };
}

function quotePdfBuffer(quote) {
  const snapshot = quote.quoteSnapshot || {}; const customer = quote.customerSnapshot || {};
  const navy = '0.055 0.12 0.34'; const ink = '0.12 0.17 0.25'; const muted = '0.36 0.42 0.51';
  const teal = '0.02 0.57 0.52'; const pale = '0.93 0.96 0.98'; const rule = '0.84 0.88 0.92';
  const pages = []; let commands = []; let cursor = 0;
  const safe = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const money = value => `KSh ${Number(value || 0).toLocaleString('en-KE')}`;
  const text = (x, y, value, size = 9, color = ink, font = 'F1', align = 'left') => {
    const content = safe(value); const width = content.length * size * (font === 'F2' ? .56 : .5);
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    commands.push(`BT /${font} ${size} Tf ${color} rg ${left.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(content)}) Tj ET`);
  };
  const rect = (x, y, w, h, color) => commands.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
  const stroke = (x1, y1, x2, y2, color = rule, width = .7) => commands.push(`q ${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
  const image = (x, y, w, h) => commands.push(`q ${w} 0 0 ${h} ${x} ${y} cm /BrandLogo Do Q`);
  const wrap = (value, max = 65) => {
    const words = safe(value).split(/\s+/).filter(Boolean); const result = []; let line = '';
    for (const word of words) { if (!line) line = word; else if (`${line} ${word}`.length <= max) line += ` ${word}`; else { result.push(line); line = word; } }
    if (line) result.push(line); return result.length ? result : [''];
  };
  const beginPage = first => {
    commands = [];
    if (first) {
      rect(0, 738, 612, 104, navy); rect(34, 759, 200, 62, '1 1 1'); image(42, 766, 184, 51);
      text(570, 805, 'QUOTATION', 10, '0.76 0.83 0.91', 'F2', 'right');
      rect(468, 769, 102, 23, '1 1 1'); text(519, 777, 'VALID OFFER', 8, navy, 'F2', 'center');
      text(42, 718, 'SCHOOL SERVICE QUOTATION', 8, teal, 'F2'); text(42, 689, quote.quoteNumber || 'Quote', 17, navy, 'F2');
      text(570, 696, `Created ${String(quote.createdAt || '').slice(0, 10)}`, 9, muted, 'F1', 'right');
      rect(42, 566, 326, 98, pale); rect(382, 566, 188, 98, pale);
      text(56, 645, 'PREPARED FOR', 8, teal, 'F2'); text(56, 626, customer.legalName || customer.name || 'Customer', 12, navy, 'F2');
      let by = 608; for (const detail of [customer.billingAddress, customer.billingEmail, customer.billingPhone, customer.taxIdentifier ? `Tax ID: ${customer.taxIdentifier}` : '']) { if (detail) { text(56, by, detail, 8, muted); by -= 11; } }
      text(396, 645, 'QUOTE DETAILS', 8, teal, 'F2'); text(396, 626, 'Valid until', 8, muted); text(554, 626, quote.expiresOn || 'As agreed', 8.5, navy, 'F2', 'right');
      text(396, 607, 'School / tenant', 8, muted); text(554, 607, customer.tenantKey || 'Not linked', 8, navy, 'F2', 'right');
      text(396, 588, 'Currency', 8, muted); text(554, 588, 'KES', 8.5, navy, 'F2', 'right');
      text(42, 544, `Enrollment snapshot: ${Number(quote.enrollmentCount || 0).toLocaleString('en-KE')} students`, 8.5, muted);
      text(570, 544, safe(snapshot.billingCadenceLabel || quote.billingCadence || ''), 8.5, muted, 'F1', 'right'); cursor = 518;
    } else {
      rect(0, 774, 612, 68, navy); rect(34, 783, 170, 45, '1 1 1'); image(41, 789, 156, 34);
      text(570, 807, `${quote.quoteNumber || 'Quote'} - CONTINUED`, 8.5, '0.76 0.83 0.91', 'F2', 'right'); cursor = 744;
    }
    pages.push(null);
  };
  const tableHeader = () => {
    rect(42, cursor - 24, 528, 24, navy); text(53, cursor - 16, 'DESCRIPTION', 7.5, '1 1 1', 'F2');
    text(385, cursor - 16, 'QTY', 7.5, '1 1 1', 'F2', 'right'); text(468, cursor - 16, 'UNIT PRICE', 7.5, '1 1 1', 'F2', 'right');
    text(558, cursor - 16, 'AMOUNT', 7.5, '1 1 1', 'F2', 'right'); cursor -= 24;
  };
  const finish = () => {
    stroke(42, 54, 570, 54); text(42, 38, 'QUOTATION - NOT A TAX INVOICE', 7.5, muted, 'F2');
    text(570, 38, `TrendSCORE | Page ${pages.length}`, 7.5, muted, 'F1', 'right'); pages[pages.length - 1] = commands.join('\n');
  };
  beginPage(true); tableHeader();
  (snapshot.lines || []).forEach((item, index) => {
    const lines = wrap(item.description || 'Service', 55); const rowHeight = Math.max(34, lines.length * 12 + 16);
    if (cursor - rowHeight < 144) { finish(); beginPage(false); tableHeader(); }
    if (index % 2) rect(42, cursor - rowHeight, 528, rowHeight, '0.975 0.982 0.988');
    lines.forEach((line, lineIndex) => text(53, cursor - 17 - lineIndex * 12, line, 8.5));
    text(385, cursor - 17, Number(item.quantity || 0).toLocaleString('en-KE'), 8.5, ink, 'F1', 'right');
    text(468, cursor - 17, money(item.unitPriceKsh), 8.5, ink, 'F1', 'right'); text(558, cursor - 17, money(item.amountKsh), 8.5, navy, 'F2', 'right');
    stroke(42, cursor - rowHeight, 570, cursor - rowHeight, rule, .45); cursor -= rowHeight;
  });
  if (cursor < 256) { finish(); beginPage(false); }
  const top = cursor - 8; text(354, top, 'Quoted subtotal', 9, muted); text(558, top, money(quote.subtotalKsh), 9, ink, 'F2', 'right');
  text(354, top - 18, 'Tax', 9, muted); text(558, top - 18, 'Not included', 8.5, muted, 'F1', 'right');
  stroke(354, top - 29, 570, top - 29); rect(344, top - 70, 226, 32, pale); text(356, top - 58, 'TOTAL QUOTED', 9, navy, 'F2');
  text(558, top - 60, money(quote.subtotalKsh), 14, navy, 'F2', 'right');
  let noteY = top - 95; text(42, noteY, 'TERMS & NOTES', 8, teal, 'F2'); noteY -= 14;
  for (const line of wrap(quote.notes || 'This quotation is subject to the validity date above.', 94).slice(0, 3)) { text(42, noteY, line, 8, muted); noteY -= 12; }
  for (const line of wrap(snapshot.taxNote || 'Tax treatment is not included in this quotation.', 94).slice(0, 2)) { text(42, noteY - 4, line, 8, muted); noteY -= 12; }
  text(42, noteY - 5, 'This quotation is not a tax invoice.', 8, navy, 'F2'); finish();
  return buildBrandedPdf(pages, { logoX: 42, logoY: 766, logoWidth: 184, logoHeight: 51 });
}

function invoicePdfBuffer(invoice) {
  const snapshot = invoice.invoiceSnapshot || {}; const customer = snapshot.customerSnapshot || {}; const quote = snapshot.quoteSnapshot || {};
  const items = Array.isArray(quote.lines) ? quote.lines : []; const navy = '0.055 0.12 0.34'; const ink = '0.12 0.17 0.25';
  const muted = '0.36 0.42 0.51'; const teal = '0.02 0.57 0.52'; const pale = '0.93 0.96 0.98'; const rule = '0.84 0.88 0.92';
  const pages = []; let commands = []; let cursor = 0; const money = value => `KSh ${Number(value || 0).toLocaleString('en-KE')}`;
  const safe = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const text = (x, y, value, size = 10, color = ink, font = 'F1', align = 'left') => { const content = safe(value); const w = content.length * size * (font === 'F2' ? .56 : .5); const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x; commands.push(`BT /${font} ${size} Tf ${color} rg ${left.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(content)}) Tj ET`); };
  const rect = (x, y, w, h, color) => commands.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
  const stroke = (x1, y1, x2, y2, color = rule, width = .7) => commands.push(`q ${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
  const image = (x, y, w, h) => commands.push(`q ${w} 0 0 ${h} ${x} ${y} cm /BrandLogo Do Q`);
  const wrap = (value, max = 58) => { const words = safe(value).split(/\s+/).filter(Boolean); const lines = []; let line = ''; for (const word of words) { if (!line) line = word; else if (`${line} ${word}`.length <= max) line += ` ${word}`; else { lines.push(line); line = word; } } if (line) lines.push(line); return lines.length ? lines : ['']; };
  const beginPage = first => {
    commands = [];
    if (first) {
      rect(0, 738, 612, 104, navy); rect(34, 759, 200, 62, '1 1 1'); image(42, 766, 184, 51);
      text(570, 805, 'INVOICE', 10, '0.76 0.83 0.91', 'F2', 'right'); rect(468, 769, 102, 23, '1 1 1'); text(519, 777, 'DRAFT', 10, navy, 'F2', 'center');
      text(42, 718, 'PREVIEW ONLY - NOT FOR PAYMENT', 8, teal, 'F2'); text(42, 689, invoice.invoiceNumber || 'Draft invoice', 17, navy, 'F2');
      text(570, 696, `Created ${String(invoice.createdAt || '').slice(0, 10) || 'Date pending'}`, 9, muted, 'F1', 'right');
      rect(42, 570, 326, 96, pale); rect(382, 570, 188, 96, pale); text(56, 647, 'BILL TO', 8, teal, 'F2');
      text(56, 628, customer.legalName || customer.name || 'Customer', 12, navy, 'F2'); let billY = 610;
      for (const detail of [customer.billingAddress, customer.billingEmail, customer.billingPhone, customer.taxIdentifier ? `Tax ID: ${customer.taxIdentifier}` : '']) if (detail) { text(56, billY, detail, 8.5, muted); billY -= 12; }
      text(396, 647, 'INVOICE DETAILS', 8, teal, 'F2'); text(396, 628, 'Status', 8, muted); text(554, 628, 'Draft', 9, navy, 'F2', 'right');
      text(396, 609, 'Source quote', 8, muted); text(554, 609, snapshot.quoteNumber || '-', 8.5, navy, 'F2', 'right');
      text(396, 590, 'Due date', 8, muted); text(554, 590, snapshot.dueDate || 'Not set', 8, navy, 'F2', 'right');
      text(42, 548, `Enrollment snapshot: ${Number(snapshot.enrollmentCount || quote.enrollmentCount || 0).toLocaleString('en-KE')} students`, 8.5, muted);
      text(570, 548, safe(quote.billingCadenceLabel || ''), 8.5, muted, 'F1', 'right'); cursor = 522;
    } else {
      rect(0, 774, 612, 68, navy); rect(34, 783, 170, 45, '1 1 1'); image(41, 789, 156, 34);
      text(570, 807, `${invoice.invoiceNumber || 'Draft invoice'} - CONTINUED`, 9, '0.76 0.83 0.91', 'F2', 'right'); text(570, 787, 'DRAFT', 9, '1 1 1', 'F2', 'right'); cursor = 744;
    }
    pages.push(null);
  };
  const tableHeader = () => { rect(42, cursor - 24, 528, 24, navy); text(53, cursor - 16, 'DESCRIPTION', 7.5, '1 1 1', 'F2'); text(385, cursor - 16, 'QTY', 7.5, '1 1 1', 'F2', 'right'); text(468, cursor - 16, 'UNIT PRICE', 7.5, '1 1 1', 'F2', 'right'); text(558, cursor - 16, 'AMOUNT', 7.5, '1 1 1', 'F2', 'right'); cursor -= 24; };
  const finish = () => { stroke(42, 54, 570, 54); text(42, 38, 'DRAFT - NOT A TAX INVOICE', 7.5, muted, 'F2'); text(570, 38, `TrendSCORE billing | Page ${pages.length}`, 7.5, muted, 'F1', 'right'); pages[pages.length - 1] = commands.join('\n'); };
  beginPage(true); tableHeader();
  items.forEach((item, index) => { const lines = wrap(item.description || 'Service', 55); const rowHeight = Math.max(34, lines.length * 12 + 16); if (cursor - rowHeight < 142) { finish(); beginPage(false); tableHeader(); } if (index % 2) rect(42, cursor - rowHeight, 528, rowHeight, '0.975 0.982 0.988'); lines.forEach((line, lineIndex) => text(53, cursor - 17 - lineIndex * 12, line, 8.5)); text(385, cursor - 17, Number(item.quantity || 0).toLocaleString('en-KE'), 8.5, ink, 'F1', 'right'); text(468, cursor - 17, money(item.unitPriceKsh), 8.5, ink, 'F1', 'right'); text(558, cursor - 17, money(item.amountKsh), 8.5, navy, 'F2', 'right'); stroke(42, cursor - rowHeight, 570, cursor - rowHeight, rule, .45); cursor -= rowHeight; });
  if (cursor < 230) { finish(); beginPage(false); }
  const top = cursor - 8; const total = Number(invoice.amountKsh || 0); text(354, top, 'Subtotal', 9, muted); text(558, top, money(total), 9, ink, 'F2', 'right');
  text(354, top - 18, 'Tax', 9, muted); text(558, top - 18, 'Not included', 8.5, muted, 'F1', 'right'); stroke(354, top - 29, 570, top - 29, rule, .8);
  rect(344, top - 70, 226, 32, pale); text(356, top - 58, 'TOTAL', 9, navy, 'F2'); text(558, top - 60, money(total), 14, navy, 'F2', 'right');
  const noteY = top - 95; text(42, noteY, 'BEFORE THIS INVOICE IS ISSUED', 8, teal, 'F2');
  const disclaimer = snapshot.taxNote || 'Tax treatment, payment terms, and seller details must be confirmed before issue.';
  wrap(disclaimer, 92).slice(0, 2).forEach((line, index) => text(42, noteY - 14 - index * 12, line, 8, muted));
  if (snapshot.termsNote) wrap(`Terms: ${snapshot.termsNote}`, 92).slice(0, 2).forEach((line, index) => text(42, noteY - 41 - index * 12, line, 8, muted));
  text(42, noteY - 66, `Prepared from accepted quote ${snapshot.quoteNumber || ''}. Amounts and line items reflect that quote snapshot.`, 8, muted);
  text(42, noteY - 81, 'This draft is for review only. It is not an issued invoice or a tax invoice.', 8, navy, 'F2'); finish();
  return buildBrandedPdf(pages, { logoX: 42, logoY: 766, logoWidth: 184, logoHeight: 51 });
}

function buildBrandedPdf(pages, logoBox) {
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '']; const firstPageId = 3; const fontRegularId = firstPageId + pages.length * 2; const fontBoldId = fontRegularId + 1;
  const logo = logoObjects(objects, fontBoldId + 1); const kids = pages.map((_page, index) => `${firstPageId + index * 2} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  pages.forEach((stream, index) => { const pageId = firstPageId + index * 2; const contentId = pageId + 1; const xObject = logo ? ` /XObject << /BrandLogo ${logo.imageId} 0 R >>` : ''; objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>${xObject} >> /Contents ${contentId} 0 R >>`; objects[contentId] = pdfStream(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>`, Buffer.from(stream, 'ascii')); });
  objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'; objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  if (logo) { void logoBox; return createPdf(objects); }
  return createPdf(objects);
}

module.exports = { quotePdfBuffer, invoicePdfBuffer };
