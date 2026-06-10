// Server-side PDF render: posts the document's self-contained HTML, returns a
// Chrome-rendered PDF matching the tool's print preview. The navy footer + page
// numbers are injected via Puppeteer's footer mechanism, because the slim
// headless-Chrome engine does not render CSS @page margin-box content.
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const PACK = 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar';
const ALLOW_ORIGIN = 'https://4pinvoice.netlify.app';

// Navy footer band (replicates the @page @bottom-left/@bottom-right boxes).
const FOOTER = `
<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;width:100%;height:100%;margin:0;padding:0;font-family:'Poppins',Arial,Helvetica,sans-serif;">
  <table style="width:100%;height:100%;border-collapse:collapse;background:#0B1C3E;color:#ffffff;"><tr>
    <td style="padding:5mm 13mm;font-size:9px;line-height:1.7;text-align:left;vertical-align:middle;color:#ffffff;">
      Thank you for your business!<br/>If you have any questions, please contact accounts@4power.biz.<br/>This is a computer-generated document and does not require a signature or stamp.<br/>&copy; 2026 4POWER Infocom FZ LLC&nbsp;&nbsp;&middot;&nbsp;&nbsp;www.4power.biz
    </td>
    <td style="padding:5mm 13mm;font-size:9px;text-align:right;vertical-align:bottom;white-space:nowrap;color:#ffffff;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </td>
  </tr></table>
</div>`;

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

  // Neutralise the document's @page margins so our page.pdf margins + footer control layout.
  const fix = '<style>@media print{@page{margin:0 !important}}</style>';
  const htmlFixed = html.includes('</head>') ? html.replace('</head>', fix + '</head>') : (fix + html);

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(PACK),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setContent(htmlFixed, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span style="font-size:0"></span>',
      footerTemplate: FOOTER,
      margin: { top: '8mm', right: '0mm', bottom: '32mm', left: '0mm' }
    });
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
