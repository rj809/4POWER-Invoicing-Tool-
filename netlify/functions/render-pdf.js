// Server-side PDF render: posts the document's self-contained HTML, returns a
// Chrome-rendered PDF identical to the tool's print preview (same engine, same @page CSS).
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Remote brotli pack keeps the function under serverless size limits.
const PACK = 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar';
const ALLOW_ORIGIN = 'https://4pinvoice.netlify.app';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'POST only' };

  let html, filename;
  try {
    const b = JSON.parse(event.body || '{}');
    html = b.html;
    filename = (b.filename || 'document.pdf').replace(/[^\w.\- ]+/g, '');
  } catch (e) {
    return { statusCode: 400, headers, body: 'invalid JSON' };
  }
  if (!html) return { statusCode: 400, headers, body: 'missing html' };

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 }, // ~A4 @150dpi
      executablePath: await chromium.executablePath(PACK),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    await browser.close();
    browser = null;
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` },
      body: Buffer.from(pdf).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    if (browser) { try { await browser.close(); } catch (_) {} }
    return { statusCode: 500, headers, body: 'render failed: ' + (e && e.message ? e.message : String(e)) };
  }
};
