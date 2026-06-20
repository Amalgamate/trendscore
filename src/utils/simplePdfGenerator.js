/**
 * simplePdfGenerator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure frontend PDF generation - no backend or server calls.
 * Uses html2canvas + jsPDF for high-fidelity A4 report capture.
 *
 * PUBLIC API:
 *   captureElement(el)               → Promise<HTMLCanvasElement>
 *   captureSingleReport(id, file, opts) → single-page PDF download
 *   captureBulkReports(id, file, opts)  → multi-page PDF (one page per .pdf-report-page)
 *   printWindow(id, opts)            → open browser print dialog
 *   generatePDFFromElement(id, file, opts) → auto-detect single vs bulk
 *
 * Legacy shims (same export names as before — zero breaking changes):
 *   generateDocument, generateCustomPDF, generatePDFWithLetterhead,
 *   generateHighFidelityPDF, generateStatementPDF
 * ─────────────────────────────────────────────────────────────────────────────
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Constants ────────────────────────────────────────────────────────────────

/** A4 dimensions in mm */
const A4_W_MM = 210;
const A4_H_MM = 297;
const A4_MARGIN_MM = 10;

/** Pixel dimensions at 96 DPI (browser default) */
const A4_W_PX = 794;
const A4_H_PX = 1123;

const getPageSpec = (orientation = 'portrait') => {
  const isLandscape = orientation === 'landscape';
  const widthMm = isLandscape ? A4_H_MM : A4_W_MM;
  const heightMm = isLandscape ? A4_W_MM : A4_H_MM;
  const widthPx = isLandscape ? A4_H_PX : A4_W_PX;
  const heightPx = isLandscape ? A4_W_PX : A4_H_PX;
  return {
    orientation: isLandscape ? 'landscape' : 'portrait',
    widthMm,
    heightMm,
    contentWidthMm: widthMm - A4_MARGIN_MM * 2,
    contentHeightMm: heightMm - A4_MARGIN_MM * 2,
    widthPx,
    heightPx,
  };
};

/**
 * Scale factor for capture.
 * 4.0 ≈ 384 DPI — Pushed to 4x for ultimate razor-sharp fidelity.
 */
const CAPTURE_SCALE = 4.0;

/** Pages to capture in parallel during bulk generation. */
const BULK_CONCURRENCY = 3;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Wait for all document fonts to load before capturing.
 * Prevents the "fallback font" bug where Poppins/Inter haven't loaded yet.
 */
const waitForFonts = () =>
  document.fonts?.ready ?? Promise.resolve();

/**
 * Wait one animation frame — lets React finish painting before capture.
 */
const nextPaint = () =>
  new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/**
 * Shared html2canvas onclone handler.
 * Normalises the captured element's layout so it exactly matches the on-screen preview:
 *  • Preserves flex/column layout (never overrides with block)
 *  • Relaxes inner .report-card height so tall content is never clipped
 *  • Forces all children visible
 *  • Ensures SVGs (bar chart, pathway bars) render correctly
 *  • Strips scripts to prevent MIME errors in the clone
 */
const buildOnclone = (opts = {}) => (_clonedDoc, clonedEl) => {
  const pageSpec = getPageSpec(opts.orientation);
  const includeLetterhead = opts.includeLetterhead === true;

  // 0. Reset the cloned document body to prevent any ancestral shifting
  _clonedDoc.documentElement.style.cssText = 'margin: 0 !important; padding: 0 !important; width: 100%; height: 100%;';
  _clonedDoc.body.style.cssText = 'margin: 0 !important; padding: 0 !important; width: 100%; height: 100%; overflow: visible !important;';

  // 1. Normalise root element to strictly match A4 pixels at (0,0)
  // We strip shadow and centering classes like 'mx-auto' so it doesn't shift
  clonedEl.classList.remove('mx-auto', 'shadow-2xl', 'shadow-lg');
  clonedEl.style.cssText = `
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    width: ${pageSpec.widthPx}px !important;
    min-height: ${pageSpec.heightPx}px !important;
    max-width: ${pageSpec.widthPx}px !important;
    display: flex !important;
    flex-direction: column !important;
    visibility: visible !important;
    opacity: 1 !important;
    overflow: visible !important;
    background: #ffffff !important;
    transform: none !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    box-shadow: none !important;
  `;

  // 2. Fix the inner .report-card for fidelity
  const card = clonedEl.querySelector('.report-card');
  if (card) {
    card.style.minHeight = `${pageSpec.heightPx}px`;
    card.style.height = 'auto';
    card.style.overflow = 'visible';
    card.style.margin = '0'; // reset any auto centering
    card.style.padding = '30px 40px'; // Re-enforce padding
  }

  // 3. Global Style Preservations & Fixes
  clonedEl.querySelectorAll('*').forEach(node => {
    const style = window.getComputedStyle(node);
    
    // Ensure visibility
    node.style.visibility = 'visible';
    node.style.opacity = '1';

    // Fix for the right-aligned elements potentially being cut off
    if (style.position === 'absolute' || style.float === 'right') {
      node.style.maxWidth = '100%';
    }

    // Force font-weight preservation (high-fidelity weights 700-1000)
    if (style.fontWeight && parseInt(style.fontWeight) >= 700) {
      node.style.fontWeight = style.fontWeight;
      node.style.color = style.color; // explicitly lock color too
    }

    // Fix background colors for branded headers (essential for deep blues)
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
      node.style.backgroundColor = style.backgroundColor;
      node.style.webkitPrintColorAdjust = 'exact';
    }
  });

  // 4. Force SVGs correctly (Header SVG, bar charts, etc.)
  _clonedDoc.querySelectorAll('svg').forEach(svg => {
    svg.style.display = 'block';
    svg.style.visibility = 'visible';
    svg.style.opacity = '1';
    svg.style.overflow = 'visible';
  });

  // 5. Strip scripts & hidden UI elements (prevents MIME errors and clutter)
  _clonedDoc.querySelectorAll('script, .no-print, .screen-only').forEach(s => s.remove());
  if (includeLetterhead) {
    clonedEl.querySelectorAll('.print-only').forEach(node => {
      node.style.display = 'block';
      node.style.visibility = 'visible';
      node.style.opacity = '1';
    });
  } else {
    clonedEl.querySelectorAll('.print-only').forEach(s => s.remove());
  }
};

/**
 * Shared html2canvas options applied to every single capture call.
 *
 * NOTE: `height` and `windowHeight` are intentionally omitted.
 * Hard-coding 1123px clips reports that contain more than ~9 subjects.
 * html2canvas reads el.scrollHeight naturally when height is not forced,
 * so tall reports expand correctly while normal A4 reports are unaffected.
 * The jsPDF page is always written at A4_H_MM — the extra canvas pixels
 * are scaled down to fit, which is the correct behaviour.
 */
const captureOptions = (opts = {}) => {
  const pageSpec = getPageSpec(opts.orientation);
  return {
  scale: CAPTURE_SCALE,
  useCORS: true,
  allowTaint: false,
  logging: false,
  backgroundColor: '#ffffff',
  width: pageSpec.widthPx,
  windowWidth: pageSpec.widthPx, // Force layout engine to A4 width
  x: 0,
  y: 0,
  scrollX: 0,
  scrollY: 0,
  onclone: buildOnclone(opts),
  };
};

const createAbortError = (message = 'Bulk PDF generation cancelled') => {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};

/**
 * Capture a single DOM element to a canvas.
 * Waits for fonts + paint before capturing.
 *
 * @param {HTMLElement} el
 * @returns {Promise<HTMLCanvasElement>}
 */
export const captureElement = async (el, opts = {}) => {
  const { signal } = opts;
  if (signal?.aborted) throw createAbortError();
  await waitForFonts();
  if (signal?.aborted) throw createAbortError();
  await nextPaint();
  if (signal?.aborted) throw createAbortError();
  return html2canvas(el, captureOptions(opts));
};

/**
 * Add a canvas to a jsPDF page as a full-bleed A4 PNG image.
 * Uses 'Best Fit' logic: Scales width to fit A4_W_MM exactly.
 */
const sliceCanvasToPages = (canvas, pageSpec = getPageSpec()) => {
  const pageHeightPx = pageSpec.heightPx;
  const pages = [];
  let yOffset = 0;

  while (yOffset < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - yOffset);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const ctx = pageCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    pages.push(pageCanvas);
    yOffset += sliceHeight;
  }

  return pages;
};

const fitCanvasToPage = (canvas, pageSpec = getPageSpec()) => {
  const rawWidth = pageSpec.contentWidthMm;
  const rawHeight = (canvas.height * rawWidth) / canvas.width;
  const scale = rawHeight > pageSpec.contentHeightMm ? pageSpec.contentHeightMm / rawHeight : 1;
  return { width: rawWidth * scale, height: rawHeight * scale };
};

const addCanvasToPdfSinglePage = (pdf, canvas, addPage = false, pageSpec = getPageSpec()) => {
  if (addPage) pdf.addPage();
  const imgData = canvas.toDataURL('image/png');
  const { width, height } = fitCanvasToPage(canvas, pageSpec);
  pdf.addImage(imgData, 'PNG', A4_MARGIN_MM, A4_MARGIN_MM, width, height);
};

const addCanvasToPdf = (pdf, canvas, addPage = false, pageSpec = getPageSpec()) => {
  const pageCanvases = sliceCanvasToPages(canvas, pageSpec);

  pageCanvases.forEach((pageCanvas, index) => {
    if (index > 0 || (index === 0 && addPage)) {
      pdf.addPage();
    }

    const imgData = pageCanvas.toDataURL('image/png');
    const imgW = pageSpec.widthMm;
    const imgH = (pageCanvas.height * pageSpec.widthMm) / pageCanvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
  });
};

/** Create a jsPDF instance configured for A4. */
const newA4Pdf = (orientation = 'portrait') =>
  new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });

const finishPdf = (pdf, filename, action = 'download') => {
  if (action === 'blob') {
    return { success: true, blob: pdf.output('blob') };
  }

  pdf.save(filename);
  return { success: true };
};

// ─── Concurrency helper ───────────────────────────────────────────────────────

/**
 * Run an array of async task factories with a maximum concurrency limit.
 * Results are returned in the same order as tasks.
 */
const runWithConcurrency = async (tasks, concurrency, signal) => {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      if (signal?.aborted) break;
      const idx = nextIndex++;
      if (idx >= tasks.length) break;
      try {
        results[idx] = await tasks[idx]();
      } catch (err) {
        results[idx] = err;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
  );
  return results;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Download a single-page PDF from one DOM element.
 *
 * @param {string}   elementId   DOM id of the element to capture
 * @param {string}   filename    e.g. "Report_Jane_Doe.pdf"
 * @param {Object}   opts
 * @param {Function} [opts.onProgress]  (message: string) => void
 * @param {boolean}  [opts.fitToPage=false]  Scale a tall capture to fit one A4 page.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const captureSingleReport = async (elementId, filename, opts = {}) => {
  const { onProgress, signal, fitToPage = false, action = 'download', orientation = 'portrait' } = opts;
  const pageSpec = getPageSpec(orientation);
  const el = document.getElementById(elementId);
  if (!el) return { success: false, error: `Element #${elementId} not found` };

  try {
    if (signal?.aborted) return { success: false, error: 'Bulk PDF generation cancelled' };
    if (onProgress) onProgress('Waiting for fonts…');
    await waitForFonts();
    await nextPaint();
    if (signal?.aborted) return { success: false, error: 'Bulk PDF generation cancelled' };

    if (onProgress) onProgress('Capturing report…');
    const canvas = await html2canvas(el, captureOptions(opts));
    if (signal?.aborted) return { success: false, error: 'Bulk PDF generation cancelled' };

    if (onProgress) onProgress('Building PDF…');
    const pdf = newA4Pdf(pageSpec.orientation);
    if (fitToPage) {
      addCanvasToPdfSinglePage(pdf, canvas, false, pageSpec);
    } else {
      addCanvasToPdf(pdf, canvas, false, pageSpec);
    }

    if (onProgress) onProgress('Saving…');
    const result = finishPdf(pdf, filename, action);
    if (onProgress) onProgress('Done!');
    return result;
  } catch (err) {
    console.error('[captureSingleReport]', err);
    return { success: false, error: err.name === 'AbortError' ? 'Bulk PDF generation cancelled' : err.message };
  }
};

/**
 * Download a multi-page PDF — one PDF page per `.pdf-report-page` child.
 * Falls back to single-page capture if no `.pdf-report-page` children exist.
 *
 * Pages are captured in parallel batches of BULK_CONCURRENCY (default 3)
 * so the browser stays responsive for 40+ learners.
 *
 * @param {string}   elementId
 * @param {string}   filename
 * @param {Object}   opts
 * @param {Function} [opts.onProgress]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const captureBulkReports = async (elementId, filename, opts = {}) => {
  const { onProgress, signal, action = 'download', orientation = 'portrait' } = opts;
  const pageSpec = getPageSpec(orientation);
  const container = document.getElementById(elementId);
  if (!container) return { success: false, error: `Element #${elementId} not found` };

  const pages = Array.from(container.querySelectorAll('.pdf-report-page'));

  // No child pages → fall back to single capture
  if (pages.length === 0) {
    return captureSingleReport(elementId, filename, opts);
  }

  try {
    if (signal?.aborted) return { success: false, error: 'Bulk PDF generation cancelled' };
    if (onProgress) onProgress('Waiting for fonts…');
    await waitForFonts();
    await nextPaint();
    if (signal?.aborted) return { success: false, error: 'Bulk PDF generation cancelled' };

    if (onProgress) onProgress(`Capturing ${pages.length} report(s) — please wait…`);

    let completed = 0;

    const tasks = pages.map((pageEl) => async () => {
      if (signal?.aborted) throw createAbortError();
      const canvas = await html2canvas(pageEl, captureOptions(opts));
      if (signal?.aborted) throw createAbortError();
      completed++;
      if (onProgress) onProgress(`Captured ${completed} of ${pages.length} pages…`);
      return canvas;
    });
    
    // Pass signal to the worker loop so it stops immediately
    const canvases = await runWithConcurrency(tasks, BULK_CONCURRENCY, signal);
    const abortError = canvases.find(result => result instanceof Error && result.name === 'AbortError');
    if (abortError) throw abortError;
    const failedError = canvases.find(result => result instanceof Error);
    if (failedError) throw failedError;

    if (signal?.aborted) return { success: false, error: 'Bulk PDF generation cancelled' };
    if (onProgress) onProgress('Building PDF…');
    const pdf = newA4Pdf(pageSpec.orientation);
    canvases.forEach((canvas, i) => addCanvasToPdf(pdf, canvas, i > 0, pageSpec));

    if (onProgress) onProgress('Saving…');
    const result = finishPdf(pdf, filename, action);
    if (onProgress) onProgress('Done!');
    return result;
  } catch (err) {
    console.error('[captureBulkReports]', err);
    return { success: false, error: err.name === 'AbortError' ? 'Bulk PDF generation cancelled' : err.message };
  }
};

/**
 * Open report HTML in a new browser tab and trigger the system print dialog.
 * This keeps text/vector content sharp (no html2canvas rasterisation).
 *
 * @param {string} elementId
 * @param {Object} opts
 * @param {Function} [opts.onProgress]
 * @param {string} [opts.title]
 * @param {boolean} [opts.autoPrint=true]
 * @param {boolean} [opts.fitToSinglePage=false]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const printWindow = async (elementId, opts = {}) => {
  const {
    onProgress,
    title = 'Report Print Preview',
    autoPrint = true,
    fitToSinglePage = false,
    orientation = 'portrait'
  } = opts;
  const isLandscape = orientation === 'landscape';
  const pageWidthMm = isLandscape ? 297 : 210;
  const pageHeightMm = isLandscape ? 210 : 297;
  const pageMarginTopMm = fitToSinglePage ? 5 : 8;
  const pageMarginBottomMm = fitToSinglePage ? 5 : 8;
  const pageMarginSideMm = fitToSinglePage ? 8 : 10;
  const pageContentWidthMm = pageWidthMm - (pageMarginSideMm * 2);
  const pageContentHeightMm = pageHeightMm - pageMarginTopMm - pageMarginBottomMm;
  const el = document.getElementById(elementId);
  if (!el) return { success: false, error: `Element #${elementId} not found` };

  try {
    if (onProgress) onProgress('Preparing print preview…');
    await waitForFonts();
    await nextPaint();

    const pages = Array.from(el.querySelectorAll('.pdf-report-page'));
    const targets = pages.length > 0 ? pages : [el];
    const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    const bodyHtml = targets
      .map((target, index) => {
        const clone = target.cloneNode(true);
        if (clone.querySelectorAll) {
          clone.querySelectorAll('.no-print, script').forEach(node => node.remove());
        }
        return `<section class="print-page ${index === targets.length - 1 ? 'last-page' : ''}">${clone.outerHTML}</section>`;
      })
      .join('\n');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${headStyles}
  <style>
    @page {
      size: A4 ${isLandscape ? 'landscape' : 'portrait'};
      margin: ${pageMarginTopMm}mm ${pageMarginSideMm}mm ${pageMarginBottomMm}mm ${pageMarginSideMm}mm;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-page {
      width: ${pageContentWidthMm}mm;
      min-height: ${pageContentHeightMm}mm;
      margin: 0 auto;
      position: relative;
      break-after: page;
      page-break-after: always;
    }
    .print-page.last-page {
      break-after: auto;
      page-break-after: auto;
    }
    body.fit-single-page .print-page {
      height: ${pageContentHeightMm}mm;
      min-height: ${pageContentHeightMm}mm;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .print-page .report-card {
      margin: 0 auto !important;
      box-shadow: none !important;
      width: 100% !important;
      min-height: auto !important;
    }
    .no-print { display: none !important; }
    .print-landscape-root {
      width: ${pageContentWidthMm}mm !important;
      min-height: ${pageContentHeightMm}mm !important;
      height: auto !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    body.landscape-print #summative-report-content {
      width: ${pageContentWidthMm}mm !important;
      min-height: ${pageContentHeightMm}mm !important;
      padding: 6mm !important;
      margin: 0 !important;
      overflow: visible !important;
      box-shadow: none !important;
    }
  </style>
</head>
<body class="${fitToSinglePage ? 'fit-single-page' : ''} ${isLandscape ? 'landscape-print' : ''}">${bodyHtml}</body>
</html>`;

    const win = window.open('', '_blank');

    if (win) {
      win.document.open();
      win.document.write(printHtml);
      win.document.close();
      win.onload = () => {
        if (fitToSinglePage) {
          const pagesInPrint = Array.from(win.document.querySelectorAll('.print-page'));

          pagesInPrint.forEach((page) => {
            const card = page.querySelector('.report-card');
            if (!card) return;

            // Move disclaimer footer out of content flow and pin it to page bottom.
            const footer = card.querySelector('.report-footer-note');
            if (footer) {
              page.appendChild(footer);
              footer.style.position = 'absolute';
              footer.style.left = '0';
              footer.style.right = '0';
              footer.style.bottom = '2.5mm';
              footer.style.margin = '0 auto';
              footer.style.textAlign = 'center';
              footer.style.fontSize = '9px';
              footer.style.lineHeight = '1.2';
              footer.style.color = '#64748b';
              footer.style.fontWeight = '400';
              footer.style.zIndex = '3';
            }

            // Reset before measurement in case browser preserved prior transform state.
            card.style.transform = 'none';
            card.style.width = '100%';
            card.style.transformOrigin = 'top left';
            card.style.paddingBottom = footer ? '12mm' : '0';

            const pageRect = page.getBoundingClientRect();
            const pageWidthPx = pageRect.width;
            const pageHeightPx = pageRect.height;
            const naturalHeight = card.scrollHeight;
            const naturalWidth = card.scrollWidth;
            const widthScale = pageWidthPx / naturalWidth;
            const heightScale = pageHeightPx / naturalHeight;
            const scale = Math.min(1, widthScale, heightScale) * 0.97;

            if (scale < 0.999) {
              card.style.display = 'block';
              card.style.margin = '0 auto';
              card.style.transformOrigin = 'center center';
              card.style.transform = `scale(${scale})`;
              card.style.width = `${naturalWidth}px`;
            }
          });
        }

        win.focus();
        if (autoPrint) win.print();
      };
    } else {
      return { success: false, error: 'Popup blocked — allow popups for this site.' };
    }

    if (onProgress) onProgress('Print dialog opened.');
    return { success: true };
  } catch (err) {
    console.error('[printWindow]', err);
    return { success: false, error: err.message };
  }
};

/**
 * General-purpose: capture any element and download as PDF.
 * Auto-detects bulk (.pdf-report-page children) vs single.
 *
 * @param {string}   elementId
 * @param {string}   filename
 * @param {Object}   opts
 * @param {Function} [opts.onProgress]
 * @param {'download'|'print'} [opts.action='download']
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const generatePDFFromElement = async (elementId, filename, opts = {}) => {
  const { action = 'download' } = opts;

  if (action === 'print') {
    return printWindow(elementId, opts);
  }

  const container = document.getElementById(elementId);
  const hasBulkPages = container?.querySelectorAll('.pdf-report-page').length > 0;

  return hasBulkPages
    ? captureBulkReports(elementId, filename, opts)
    : captureSingleReport(elementId, filename, opts);
};

// ─── Legacy compatibility shims ───────────────────────────────────────────────
// These match the old export names — zero breaking changes for other files.

export const generateCustomPDF = (elementId, filename, opts) =>
  generatePDFFromElement(elementId, filename, opts);

export const generatePDFWithLetterhead = (elementId, filename, _schoolInfo, opts = {}) =>
  generatePDFFromElement(elementId, filename, opts);

export const generateHighFidelityPDF = (elementId, filename, opts) =>
  generatePDFFromElement(elementId, filename, opts);

/**
 * generateStatementPDF — fee statement PDF.
 * Accepts the old positional args (learner, invoices, payments) plus an opts object.
 * opts.elementId defaults to 'statement-content'.
 * opts.action: 'download' (default) | 'print'
 * opts.fitToPage: true will scale the statement into a single A4 page.
 */
export const generateStatementPDF = (_learner, _invoices, _payments, opts = {}) => {
  const filename = opts.fileName || opts.filename ||
    `Statement_${_learner?.firstName || ''}_${_learner?.lastName || ''}_${new Date().getFullYear()}.pdf`;
  const elementId = opts.elementId || 'statement-content';
  const action = opts.action === 'print' ? 'print' : 'download';
  return generatePDFFromElement(elementId, filename, { ...opts, action, fitToPage: true });
};

/**
 * generateDocument - previously routed to the backend PDF service.
 * Now runs entirely in the browser.
 *
 * If opts.elementId is provided, captures that element directly.
 * If opts.html is provided as raw HTML string, renders it in a hidden iframe,
 * captures it, then removes the iframe.
 */
export const generateDocument = async (opts = {}) => {
  const {
    elementId,
    html,
    fileName = 'document.pdf',
    action = 'download',
    onProgress,
  } = opts;

  // Path 1: element already in the DOM
  if (elementId) {
    return generatePDFFromElement(elementId, fileName, { action, onProgress });
  }

  // Path 2: raw HTML string — render in a hidden iframe then capture
  if (html) {
    return new Promise((resolve) => {
      if (onProgress) onProgress('Rendering document…');

      const iframe = document.createElement('iframe');
      iframe.style.cssText = `
        position: fixed; left: -9999px; top: 0;
        width: ${A4_W_PX}px; height: ${A4_H_PX}px;
        border: none; background: #fff; z-index: -1; visibility: hidden;
      `;
      document.body.appendChild(iframe);

      const cleanup = () => {
        try { document.body.removeChild(iframe); } catch (_) {}
      };

      iframe.onload = async () => {
        try {
          await waitForFonts();
          await nextPaint();

          const body = iframe.contentDocument?.body;
          if (!body) {
            cleanup();
            return resolve({ success: false, error: 'iframe body not accessible' });
          }

          if (onProgress) onProgress('Capturing…');
          const canvas = await html2canvas(body, { ...captureOptions(), scrollX: 0, scrollY: 0 });
          cleanup();

          if (action === 'print') {
            const img = canvas.toDataURL('image/png');
            const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0}body{background:#fff}img{display:block;width:210mm}@page{size:A4 portrait;margin:0}</style></head><body><img src="${img}"/></body></html>`;
            const blob = new Blob([printHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (win) win.onload = () => { win.focus(); win.print(); };
            return resolve({ success: true });
          }

          const pdf = newA4Pdf();
          addCanvasToPdf(pdf, canvas, false);
          pdf.save(fileName);
          if (onProgress) onProgress('Done!');
          return resolve({ success: true });

        } catch (err) {
          cleanup();
          console.error('[generateDocument iframe]', err);
          return resolve({ success: false, error: err.message });
        }
      };

      iframe.onerror = () => {
        cleanup();
        resolve({ success: false, error: 'Failed to load iframe' });
      };

      iframe.srcdoc = html;
    });
  }

  return { success: false, error: 'generateDocument: provide either elementId or html' };
};

// ─── Default export (object shim for legacy import styles) ───────────────────
const simplePdf = {
  generateDocument,
  generatePDFFromElement,
  generatePDFWithLetterhead,
  generateHighFidelityPDF,
  generateStatementPDF,
  captureSingleReport,
  captureBulkReports,
  captureElement,
  printWindow,
};

export default simplePdf;
