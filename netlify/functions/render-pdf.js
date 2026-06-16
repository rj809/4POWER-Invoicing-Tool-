// Server-side PDF render. Chrome renders the document body (pixel-perfect), then
// pdf-lib stamps the navy footer band + real page numbers onto every page —
// because the slim Lambda Chromium renders neither @page margin boxes nor
// Puppeteer footer templates.
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PACK = 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar';
const ALLOW_ORIGIN = 'https://4pinvoice.netlify.app';
const MM = 2.834645; // pt per mm
const NAVY = rgb(11 / 255, 28 / 255, 68 / 255);   // #0B1C3E
const MUTED = rgb(138 / 255, 147 / 255, 162 / 255); // #8A93A2
const WHITE = rgb(1, 1, 1);
const FOOT_TY = 'Thank you for your business!';
const FOOT_Q = 'If you have any questions, please contact accounts@4power.biz.';
const FOOT_NOSIG = 'This is a computer-generated document and does not require a signature or stamp.';
const FOOT_CP = '\u00A9 2026 4POWER Infocom FZ LLC   \u00B7   www.4power.biz';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'POST only' };

  let html, filename, headerRef, signoff;
  try {
    const b = JSON.parse(event.body || '{}');
    html = b.html;
    filename = (b.filename || 'document.pdf').replace(/[^\w.\- ]+/g, '');
    headerRef = (b.headerRef || '').toString().slice(0, 120);
    signoff = !!b.signoff;
  } catch (e) {
    return { statusCode: 400, headers, body: 'invalid JSON' };
  }
  if (!html) return { statusCode: 400, headers, body: 'missing html' };

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(PACK),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    // Body render honours the document's @page (A4, 32mm bottom margin reserved for the footer band).
    const bodyPdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    await browser.close();
    browser = null;

    // Stamp footer + page numbers with pdf-lib.
    const doc = await PDFDocument.load(bodyPdf);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const N = pages.length;
    const bandH = 32 * MM;
    const padX = 13 * MM;
    // Signoff documents (installation report, packing slip, delivery note) collect a wet signature,
    // so the "computer-generated / no signature" line is omitted for them.
    const footlines = signoff ? [FOOT_TY, FOOT_Q, FOOT_CP] : [FOOT_TY, FOOT_Q, FOOT_NOSIG, FOOT_CP];
    pages.forEach((p, idx) => {
      const { width, height } = p.getSize();
      // navy band
      p.drawRectangle({ x: 0, y: 0, width, height: bandH, color: NAVY });
      // left text block, top-aligned within the band
      let y = bandH - 5 * MM - 8;
      const size = 8, lh = size * 1.7;
      footlines.forEach((ln, i) => p.drawText(ln, { x: padX, y: y - i * lh, size, font, color: WHITE }));
      // page number, bottom-right
      const pn = 'Page ' + (idx + 1) + ' of ' + N;
      const pw = font.widthOfTextAtSize(pn, size);
      p.drawText(pn, { x: width - padX - pw, y: 7 * MM, size, font, color: WHITE });
      // continuation reference, top-left on pages after the first
      if (idx > 0 && headerRef) {
        p.drawText(headerRef, { x: padX, y: height - 11 * MM, size: 7.5, font, color: MUTED });
      }
    });
    const out = await doc.save();
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` },
      body: Buffer.from(out).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    if (browser) { try { await browser.close(); } catch (_) {} }
    return { statusCode: 500, headers, body: 'render failed: ' + (e && e.message ? e.message : String(e)) };
  }
};
